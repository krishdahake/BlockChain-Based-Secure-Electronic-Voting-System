const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Voting", () => {
  async function deploy() {
    const [admin, v1, v2, v3, outsider] = await ethers.getSigners();
    const voting = await (await ethers.getContractFactory("Voting")).deploy(admin.address);
    const now = await time.latest();
    const start = now + 100, end = now + 1000;
    await voting.createElection("Student Council", "Annual", start, end);
    await voting.addCandidate(1, "cand-A");
    await voting.addCandidate(1, "cand-B");
    await voting.registerVoters(1, [v1.address, v2.address, v3.address]);
    return { voting, admin, v1, v2, v3, outsider, start, end };
  }

  describe("election creation", () => {
    it("creates an election with correct data", async () => {
      const { voting, start, end } = await loadFixture(deploy);
      const e = await voting.getElection(1);
      expect(e.name).to.equal("Student Council");
      expect(e.startTime).to.equal(start);
      expect(e.endTime).to.equal(end);
      expect(e.active).to.equal(true);
      expect(e.candidateCount).to.equal(2);
    });
    it("emits ElectionCreated", async () => {
      const { voting } = await loadFixture(deploy);
      const now = await time.latest();
      await expect(voting.createElection("X", "", now + 10, now + 20)).to.emit(voting, "ElectionCreated");
    });
    it("rejects invalid schedule and empty name", async () => {
      const { voting } = await loadFixture(deploy);
      const now = await time.latest();
      await expect(voting.createElection("X", "", now + 20, now + 10)).to.be.revertedWith("End must be after start");
      await expect(voting.createElection("", "", now + 10, now + 20)).to.be.revertedWith("Name required");
    });
    it("rejects non-admin actions", async () => {
      const { voting, outsider } = await loadFixture(deploy);
      const now = await time.latest();
      await expect(voting.connect(outsider).createElection("X", "", now + 10, now + 20)).to.be.reverted;
      await expect(voting.connect(outsider).addCandidate(1, "evil")).to.be.reverted;
      await expect(voting.connect(outsider).registerVoter(1, outsider.address)).to.be.reverted;
      await expect(voting.connect(outsider).setElectionActive(1, false)).to.be.reverted;
    });
    it("blocks candidate additions after start", async () => {
      const { voting, start } = await loadFixture(deploy);
      await time.increaseTo(start);
      await expect(voting.addCandidate(1, "late")).to.be.revertedWith("Election already started");
    });
  });

  describe("voter registration", () => {
    it("registers voters and emits events", async () => {
      const { voting, outsider } = await loadFixture(deploy);
      await expect(voting.registerVoter(1, outsider.address)).to.emit(voting, "VoterRegistered").withArgs(1, outsider.address);
      expect(await voting.isRegisteredVoter(1, outsider.address)).to.equal(true);
    });
    it("rejects zero address", async () => {
      const { voting } = await loadFixture(deploy);
      await expect(voting.registerVoter(1, ethers.ZeroAddress)).to.be.revertedWith("Invalid voter");
    });
  });

  describe("voting", () => {
    it("records a valid vote and emits VoteCast", async () => {
      const { voting, v1, start } = await loadFixture(deploy);
      await time.increaseTo(start);
      await expect(voting.connect(v1).vote(1, 1)).to.emit(voting, "VoteCast");
      expect(await voting.hasVoted(1, v1.address)).to.equal(true);
      expect(await voting.getTotalVotes(1)).to.equal(1);
    });
    it("prevents duplicate voting", async () => {
      const { voting, v1, start } = await loadFixture(deploy);
      await time.increaseTo(start);
      await voting.connect(v1).vote(1, 1);
      await expect(voting.connect(v1).vote(1, 2)).to.be.revertedWith("Already voted");
    });
    it("prevents unauthorized voting", async () => {
      const { voting, outsider, start } = await loadFixture(deploy);
      await time.increaseTo(start);
      await expect(voting.connect(outsider).vote(1, 1)).to.be.revertedWith("Not an authorized voter");
    });
    it("prevents voting before start", async () => {
      const { voting, v1 } = await loadFixture(deploy);
      await expect(voting.connect(v1).vote(1, 1)).to.be.revertedWith("Election not started");
    });
    it("prevents voting after end", async () => {
      const { voting, v1, end } = await loadFixture(deploy);
      await time.increaseTo(end);
      await expect(voting.connect(v1).vote(1, 1)).to.be.revertedWith("Election ended");
    });
    it("prevents voting when deactivated", async () => {
      const { voting, v1, start } = await loadFixture(deploy);
      await voting.setElectionActive(1, false);
      await time.increaseTo(start);
      await expect(voting.connect(v1).vote(1, 1)).to.be.revertedWith("Election not active");
    });
    it("rejects invalid candidate", async () => {
      const { voting, v1, start } = await loadFixture(deploy);
      await time.increaseTo(start);
      await expect(voting.connect(v1).vote(1, 99)).to.be.revertedWith("Invalid candidate");
      await expect(voting.connect(v1).vote(1, 0)).to.be.revertedWith("Invalid candidate");
    });
    it("rejects nonexistent election", async () => {
      const { voting, v1 } = await loadFixture(deploy);
      await expect(voting.connect(v1).vote(42, 1)).to.be.revertedWith("Election does not exist");
    });
    it("voter registered for election 1 cannot vote in election 2", async () => {
      const { voting, v1 } = await loadFixture(deploy);
      const now = await time.latest();
      await voting.createElection("Second", "", now + 10, now + 500);
      await voting.addCandidate(2, "x");
      await time.increase(20);
      await expect(voting.connect(v1).vote(2, 1)).to.be.revertedWith("Not an authorized voter");
    });
  });

  describe("results", () => {
    it("hides tallies before the election ends", async () => {
      const { voting, v1, start } = await loadFixture(deploy);
      await time.increaseTo(start);
      await voting.connect(v1).vote(1, 1);
      await expect(voting.getResults(1)).to.be.revertedWith("Results not available until election ends");
      await expect(voting.getVoteCount(1, 1)).to.be.revertedWith("Results not available until election ends");
    });
    it("calculates results correctly after end", async () => {
      const { voting, v1, v2, v3, start, end } = await loadFixture(deploy);
      await time.increaseTo(start);
      await voting.connect(v1).vote(1, 1);
      await voting.connect(v2).vote(1, 2);
      await voting.connect(v3).vote(1, 2);
      await time.increaseTo(end);
      const r = await voting.getResults(1);
      expect(r.names).to.deep.equal(["cand-A", "cand-B"]);
      expect(r.votes.map(Number)).to.deep.equal([1, 2]);
      expect(r.totalVotes).to.equal(3);
      expect(await voting.getVoteCount(1, 2)).to.equal(2);
    });
  });
});
