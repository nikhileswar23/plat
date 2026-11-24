// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * PropertyAuction
 * Land registry + sealed-bid (commit-reveal) auction + permanent property history.
 *
 * Roles
 *  - Registrar : land office wallet (the deployer). Registers properties, can freeze/unfreeze.
 *  - Owner     : current owner of a property. Can list it for auction.
 *  - Bidder    : anyone except the seller.
 *
 * Flow
 *  1. registrar.registerProperty(...)
 *  2. owner.createAuction(...)            -> property becomes InAuction (double-sale block)
 *  3. bidders.commitBid(...) + deposit    -> only a hash is stored
 *  4. bidders.revealBid(...)              -> hash is checked
 *  5. anyone.settle(...)                  -> ownership moves, history is written
 *  6. winner/losers.claimRefund(), seller.claimProceeds()
 *
 * DEMO ONLY: demoMode lets the seller skip timers. Deploy with false for a "real" run.
 * Use fake data only. Never put personal details or national IDs on-chain.
 */
contract PropertyAuction {
    // ---------------------------------------------------------------- types
    enum PropStatus { Available, InAuction, Frozen }

    struct Property {
        address owner;
        bytes32 deedHash;      // keccak256 / sha256 of the deed PDF (file itself lives in Supabase)
        string location;
        PropStatus status;
        bool exists;
    }

    struct HistoryEntry {
        string kind;           // REGISTERED, SOLD, FROZEN, UNFROZEN
        address from;
        address to;
        uint256 price;         // wei, 0 if not a sale
        uint256 timestamp;
        uint256 auctionId;     // 0 if not from an auction
    }

    struct Auction {
        uint256 propertyId;
        address seller;
        uint256 minBid;
        uint256 commitEnd;
        uint256 revealEnd;
        uint256 totalDeposits;
        uint256 revealedDeposits;
        uint256 highestBid;
        address highestBidder;
        bool settled;
        bool cancelled;
        bool proceedsClaimed;
    }

    struct Bid {
        bytes32 commitment;
        uint256 deposit;
        bool revealed;
        bool refunded;
    }

    // ---------------------------------------------------------------- state
    address public immutable registrar;
    bool public immutable demoMode;

    mapping(uint256 => Property) public properties;
    mapping(uint256 => HistoryEntry[]) private _history;

    uint256 public auctionCount;
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => Bid)) public bids;

    uint256 private _lock = 1;

    // ---------------------------------------------------------------- events
    event PropertyRegistered(uint256 indexed propertyId, address indexed owner, bytes32 deedHash, string location);
    event PropertyFrozen(uint256 indexed propertyId, string reason);
    event PropertyUnfrozen(uint256 indexed propertyId);
    event AuctionCreated(uint256 indexed auctionId, uint256 indexed propertyId, address seller, uint256 minBid, uint256 commitEnd, uint256 revealEnd);
    event BidCommitted(uint256 indexed auctionId, address indexed bidder);
    event BidRevealed(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed auctionId, uint256 indexed propertyId, address winner, uint256 price);
    event AuctionCancelled(uint256 indexed auctionId);

    // ---------------------------------------------------------------- modifiers
    modifier onlyRegistrar() {
        require(msg.sender == registrar, "Only registrar");
        _;
    }

    modifier nonReentrant() {
        require(_lock == 1, "Reentrancy");
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(bool _demoMode) {
        registrar = msg.sender;
        demoMode = _demoMode;
    }

    // ================================================================ REGISTRY
    function registerProperty(
        uint256 propertyId,
        address owner,
        bytes32 deedHash,
        string calldata location
    ) external onlyRegistrar {
        require(!properties[propertyId].exists, "Plot already exists");
        require(owner != address(0), "Bad owner");

        properties[propertyId] = Property(owner, deedHash, location, PropStatus.Available, true);
        _history[propertyId].push(HistoryEntry("REGISTERED", address(0), owner, 0, block.timestamp, 0));

        emit PropertyRegistered(propertyId, owner, deedHash, location);
    }

    function freezeProperty(uint256 propertyId, string calldata reason) external onlyRegistrar {
        Property storage p = properties[propertyId];
        require(p.exists, "No such plot");
        require(p.status == PropStatus.Available, "Plot not available");
        p.status = PropStatus.Frozen;
        _history[propertyId].push(HistoryEntry("FROZEN", p.owner, p.owner, 0, block.timestamp, 0));
        emit PropertyFrozen(propertyId, reason);
    }

    function unfreezeProperty(uint256 propertyId) external onlyRegistrar {
        Property storage p = properties[propertyId];
        require(p.exists, "No such plot");
        require(p.status == PropStatus.Frozen, "Not frozen");
        p.status = PropStatus.Available;
        _history[propertyId].push(HistoryEntry("UNFROZEN", p.owner, p.owner, 0, block.timestamp, 0));
        emit PropertyUnfrozen(propertyId);
    }

    /// Public deed check: true if the uploaded file's hash matches the registered one.
    function verifyDeed(uint256 propertyId, bytes32 fileHash) external view returns (bool) {
        require(properties[propertyId].exists, "No such plot");
        return properties[propertyId].deedHash == fileHash;
    }

    /// Full ownership history, oldest first.
    function getHistory(uint256 propertyId) external view returns (HistoryEntry[] memory) {
        return _history[propertyId];
    }

    function historyLength(uint256 propertyId) external view returns (uint256) {
        return _history[propertyId].length;
    }

    // ================================================================ AUCTION
    function createAuction(
        uint256 propertyId,
        uint256 minBid,
        uint256 commitSeconds,
        uint256 revealSeconds
    ) external returns (uint256 auctionId) {
        Property storage p = properties[propertyId];
        require(p.exists, "No such plot");
        require(msg.sender == p.owner, "Not the owner");
        require(p.status != PropStatus.Frozen, "Plot frozen");
        require(p.status == PropStatus.Available, "Plot locked in auction");
        require(minBid > 0, "Min bid must be > 0");
        require(commitSeconds > 0 && revealSeconds > 0, "Bad durations");

        p.status = PropStatus.InAuction;

        auctionId = ++auctionCount;
        auctions[auctionId] = Auction({
            propertyId: propertyId,
            seller: msg.sender,
            minBid: minBid,
            commitEnd: block.timestamp + commitSeconds,
            revealEnd: block.timestamp + commitSeconds + revealSeconds,
            totalDeposits: 0,
            revealedDeposits: 0,
            highestBid: 0,
            highestBidder: address(0),
            settled: false,
            cancelled: false,
            proceedsClaimed: false
        });

        emit AuctionCreated(auctionId, propertyId, msg.sender, minBid, auctions[auctionId].commitEnd, auctions[auctionId].revealEnd);
    }

    /// Helper for the frontend / Remix demo. Binds the commitment to auction + bidder so it can't be copied.
    function makeCommitment(uint256 auctionId, address bidder, uint256 amount, bytes32 secret)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(auctionId, bidder, amount, secret));
    }

    function commitBid(uint256 auctionId, bytes32 commitment) external payable {
        Auction storage a = auctions[auctionId];
        require(a.seller != address(0), "No such auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp < a.commitEnd, "Bidding closed");
        require(msg.sender != a.seller, "Seller cannot bid");
        require(msg.value >= a.minBid, "Deposit below minimum");
        require(bids[auctionId][msg.sender].deposit == 0, "Already committed");

        bids[auctionId][msg.sender] = Bid(commitment, msg.value, false, false);
        a.totalDeposits += msg.value;

        emit BidCommitted(auctionId, msg.sender);
    }

    function revealBid(uint256 auctionId, uint256 amount, bytes32 secret) external {
        Auction storage a = auctions[auctionId];
        require(a.seller != address(0), "No such auction");
        require(!a.cancelled, "Auction cancelled");
        require(block.timestamp >= a.commitEnd, "Reveal not open");
        require(block.timestamp < a.revealEnd, "Reveal closed");

        Bid storage b = bids[auctionId][msg.sender];
        require(b.deposit > 0, "No bid found");
        require(!b.revealed, "Already revealed");
        require(makeCommitment(auctionId, msg.sender, amount, secret) == b.commitment, "Hash mismatch");
        require(amount <= b.deposit, "Deposit too low");
        require(amount >= a.minBid, "Below minimum");

        b.revealed = true;
        a.revealedDeposits += b.deposit;

        // Strictly greater: on a tie, the earlier reveal wins.
        if (amount > a.highestBid) {
            a.highestBid = amount;
            a.highestBidder = msg.sender;
        }

        emit BidRevealed(auctionId, msg.sender, amount);
    }

    /// Anyone can settle once the reveal window is over.
    function settle(uint256 auctionId) external {
        Auction storage a = auctions[auctionId];
        require(a.seller != address(0), "No such auction");
        require(!a.cancelled, "Auction cancelled");
        require(!a.settled, "Already settled");
        require(block.timestamp >= a.revealEnd, "Auction not finished");

        a.settled = true;
        Property storage p = properties[a.propertyId];
        p.status = PropStatus.Available;

        if (a.highestBidder != address(0)) {
            address previousOwner = p.owner;
            p.owner = a.highestBidder;
            _history[a.propertyId].push(
                HistoryEntry("SOLD", previousOwner, a.highestBidder, a.highestBid, block.timestamp, auctionId)
            );
        }

        emit AuctionSettled(auctionId, a.propertyId, a.highestBidder, a.highestBid);
    }

    /// Seller can cancel only before bidding closes and only if nobody has bid.
    function cancelAuction(uint256 auctionId) external {
        Auction storage a = auctions[auctionId];
        require(a.seller != address(0), "No such auction");
        require(msg.sender == a.seller, "Only seller");
        require(!a.cancelled && !a.settled, "Already finished");
        require(block.timestamp < a.commitEnd, "Bidding closed");
        require(a.totalDeposits == 0, "Bids already placed");

        a.cancelled = true;
        properties[a.propertyId].status = PropStatus.Available;
        emit AuctionCancelled(auctionId);
    }

    // ================================================================ PAYOUTS (pull pattern)

    /// Losers get the full deposit back. The winner gets deposit minus the winning price.
    /// Bidders who never revealed forfeit their deposit to the seller.
    function claimRefund(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.settled, "Auction not finished");

        Bid storage b = bids[auctionId][msg.sender];
        require(b.deposit > 0, "Not your deposit");
        require(b.revealed, "Deposit forfeited");
        require(!b.refunded, "Already refunded");

        uint256 refund = b.deposit;
        if (msg.sender == a.highestBidder) {
            refund -= a.highestBid;
        }

        b.refunded = true;
        if (refund > 0) {
            (bool ok, ) = msg.sender.call{value: refund}("");
            require(ok, "Transfer failed");
        }
    }

    /// Seller receives the winning bid plus any forfeited deposits.
    function claimProceeds(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(msg.sender == a.seller, "Only seller");
        require(a.settled, "Auction not finished");
        require(!a.proceedsClaimed, "Already claimed");

        uint256 forfeited = a.totalDeposits - a.revealedDeposits;
        uint256 amount = a.highestBid + forfeited;

        a.proceedsClaimed = true;
        if (amount > 0) {
            (bool ok, ) = msg.sender.call{value: amount}("");
            require(ok, "Transfer failed");
        }
    }

    // ================================================================ VIEWS
    /// 0 = Commit, 1 = Reveal, 2 = Ended
    function phase(uint256 auctionId) external view returns (uint8) {
        Auction storage a = auctions[auctionId];
        require(a.seller != address(0), "No such auction");
        if (block.timestamp < a.commitEnd) return 0;
        if (block.timestamp < a.revealEnd) return 1;
        return 2;
    }

    // ================================================================ DEMO ONLY
    function demoSkipToReveal(uint256 auctionId) external {
        require(demoMode, "Demo mode off");
        Auction storage a = auctions[auctionId];
        require(msg.sender == a.seller, "Only seller");
        if (a.commitEnd > block.timestamp) a.commitEnd = block.timestamp;
    }

    function demoSkipToEnd(uint256 auctionId) external {
        require(demoMode, "Demo mode off");
        Auction storage a = auctions[auctionId];
        require(msg.sender == a.seller, "Only seller");
        if (a.commitEnd > block.timestamp) a.commitEnd = block.timestamp;
        if (a.revealEnd > block.timestamp) a.revealEnd = block.timestamp;
    }
}
