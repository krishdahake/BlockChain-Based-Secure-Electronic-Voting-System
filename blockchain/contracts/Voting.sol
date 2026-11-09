// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Voting
 * @notice Multi-election voting contract. Only wallet addresses and opaque
 *         references (e.g. MongoDB ids) are stored - never personal data.
 *
 * PRIVACY NOTE: votes are recorded transparently. Every vote transaction
 * (voter address -> candidate id) is public on-chain, so this design does NOT
 * provide ballot secrecy. Per-candidate tallies are hidden behind a getter that
 * reverts until the election ends, but that is access control at the contract
 * API level only - raw storage and transaction history remain publicly readable.
 */
contract Voting is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Election {
        string name;
        string description;
        uint64 startTime;
        uint64 endTime;
        bool active;
        uint32 candidateCount;
        uint256 totalVotes;
        bool exists;
    }

    struct Candidate {
        string name; // display name or off-chain reference id
        bool exists;
    }

    uint256 public electionCount;

    mapping(uint256 => Election) private elections;
    mapping(uint256 => mapping(uint256 => Candidate)) private candidates; // election => candidateId (1-based)
    mapping(uint256 => mapping(uint256 => uint256)) private voteCounts;   // election => candidateId => votes
    mapping(uint256 => mapping(address => bool)) public isRegisteredVoter; // election => voter
    mapping(uint256 => mapping(address => bool)) public hasVoted;          // election => voter

    event ElectionCreated(uint256 indexed electionId, string name, uint64 startTime, uint64 endTime);
    event ElectionUpdated(uint256 indexed electionId, string name, string description, uint64 startTime, uint64 endTime);
    event ElectionStatusChanged(uint256 indexed electionId, bool active);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event VoterRegistered(uint256 indexed electionId, address indexed voter);
    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter, uint256 timestamp);

    modifier electionExists(uint256 electionId) {
        require(elections[electionId].exists, "Election does not exist");
        _;
    }

    constructor(address admin) {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // ------------------------------------------------------------------
    // Election management
    // ------------------------------------------------------------------

    function createElection(
        string calldata name,
        string calldata description,
        uint64 startTime,
        uint64 endTime
    ) external onlyRole(ADMIN_ROLE) returns (uint256 electionId) {
        require(bytes(name).length > 0, "Name required");
        require(endTime > startTime, "End must be after start");
        require(endTime > block.timestamp, "End must be in the future");

        electionId = ++electionCount;
        elections[electionId] = Election({
            name: name,
            description: description,
            startTime: startTime,
            endTime: endTime,
            active: true,
            candidateCount: 0,
            totalVotes: 0,
            exists: true
        });
        emit ElectionCreated(electionId, name, startTime, endTime);
    }

    /// @notice Edit metadata/schedule. Not allowed once voting has started.
    function updateElection(
        uint256 electionId,
        string calldata name,
        string calldata description,
        uint64 startTime,
        uint64 endTime
    ) external onlyRole(ADMIN_ROLE) electionExists(electionId) {
        Election storage e = elections[electionId];
        require(block.timestamp < e.startTime, "Election already started");
        require(bytes(name).length > 0, "Name required");
        require(endTime > startTime && endTime > block.timestamp, "Invalid schedule");
        e.name = name;
        e.description = description;
        e.startTime = startTime;
        e.endTime = endTime;
        emit ElectionUpdated(electionId, name, description, startTime, endTime);
    }

    function setElectionActive(uint256 electionId, bool active)
        external
        onlyRole(ADMIN_ROLE)
        electionExists(electionId)
    {
        elections[electionId].active = active;
        emit ElectionStatusChanged(electionId, active);
    }

    // ------------------------------------------------------------------
    // Candidates & voters
    // ------------------------------------------------------------------

    function addCandidate(uint256 electionId, string calldata name)
        external
        onlyRole(ADMIN_ROLE)
        electionExists(electionId)
        returns (uint256 candidateId)
    {
        Election storage e = elections[electionId];
        require(block.timestamp < e.startTime, "Election already started");
        require(bytes(name).length > 0, "Candidate name required");

        candidateId = ++e.candidateCount;
        candidates[electionId][candidateId] = Candidate({name: name, exists: true});
        emit CandidateAdded(electionId, candidateId, name);
    }

    function registerVoter(uint256 electionId, address voter)
        external
        onlyRole(ADMIN_ROLE)
        electionExists(electionId)
    {
        _registerVoter(electionId, voter);
    }

    function registerVoters(uint256 electionId, address[] calldata voters)
        external
        onlyRole(ADMIN_ROLE)
        electionExists(electionId)
    {
        for (uint256 i = 0; i < voters.length; i++) {
            _registerVoter(electionId, voters[i]);
        }
    }

    function _registerVoter(uint256 electionId, address voter) private {
        require(voter != address(0), "Invalid voter");
        require(block.timestamp < elections[electionId].endTime, "Election ended");
        if (!isRegisteredVoter[electionId][voter]) {
            isRegisteredVoter[electionId][voter] = true;
            emit VoterRegistered(electionId, voter);
        }
    }

    // ------------------------------------------------------------------
    // Voting
    // ------------------------------------------------------------------

    function vote(uint256 electionId, uint256 candidateId)
        external
        nonReentrant
        electionExists(electionId)
    {
        Election storage e = elections[electionId];
        require(e.active, "Election not active");
        require(block.timestamp >= e.startTime, "Election not started");
        require(block.timestamp < e.endTime, "Election ended");
        require(isRegisteredVoter[electionId][msg.sender], "Not an authorized voter");
        require(!hasVoted[electionId][msg.sender], "Already voted");
        require(candidates[electionId][candidateId].exists, "Invalid candidate");

        // effects
        hasVoted[electionId][msg.sender] = true;
        voteCounts[electionId][candidateId] += 1;
        e.totalVotes += 1;

        emit VoteCast(electionId, candidateId, msg.sender, block.timestamp);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getElection(uint256 electionId)
        external
        view
        electionExists(electionId)
        returns (
            string memory name,
            string memory description,
            uint64 startTime,
            uint64 endTime,
            bool active,
            uint32 candidateCount
        )
    {
        Election storage e = elections[electionId];
        return (e.name, e.description, e.startTime, e.endTime, e.active, e.candidateCount);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        electionExists(electionId)
        returns (string memory name)
    {
        require(candidates[electionId][candidateId].exists, "Invalid candidate");
        return candidates[electionId][candidateId].name;
    }

    function hasElectionEnded(uint256 electionId) public view electionExists(electionId) returns (bool) {
        return block.timestamp >= elections[electionId].endTime;
    }

    /// @notice Participation count (turnout) is available any time; tallies are not.
    function getTotalVotes(uint256 electionId) external view electionExists(electionId) returns (uint256) {
        return elections[electionId].totalVotes;
    }

    /// @notice Per-candidate tally. Only available once the election has ended.
    function getVoteCount(uint256 electionId, uint256 candidateId)
        external
        view
        electionExists(electionId)
        returns (uint256)
    {
        require(hasElectionEnded(electionId), "Results not available until election ends");
        require(candidates[electionId][candidateId].exists, "Invalid candidate");
        return voteCounts[electionId][candidateId];
    }

    /// @notice All candidate ids/names/tallies. Only available once the election has ended.
    function getResults(uint256 electionId)
        external
        view
        electionExists(electionId)
        returns (uint256[] memory ids, string[] memory names, uint256[] memory votes, uint256 totalVotes)
    {
        require(hasElectionEnded(electionId), "Results not available until election ends");
        uint32 n = elections[electionId].candidateCount;
        ids = new uint256[](n);
        names = new string[](n);
        votes = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 cid = i + 1;
            ids[i] = cid;
            names[i] = candidates[electionId][cid].name;
            votes[i] = voteCounts[electionId][cid];
        }
        totalVotes = elections[electionId].totalVotes;
    }
}
