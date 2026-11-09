import { Link } from "react-router-dom";

const Section = ({ title, children }) => (<section className="card"><h2 className="mb-3 text-xl font-bold text-navy-900">{title}</h2><div className="space-y-3 text-sm leading-relaxed text-slate-600">{children}</div></section>);

export default function About() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-14 sm:px-6">
      <div><h1 className="text-3xl font-extrabold text-navy-900">About the project</h1>
        <p className="mt-3 text-slate-600">SmartVote is a full-stack, blockchain-based voting system built as a college semester PBL project. It combines a conventional web stack for identity and administration with an Ethereum smart contract that is the single source of truth for votes.</p></div>
      <Section title="Architecture">
        <p><b>MongoDB</b> holds user profiles, hashed credentials, election metadata, candidate applications and transaction references. <b>Express</b> exposes a role-protected REST API. <b>React</b> provides the dashboards. <b>Solidity</b> (<code>Voting.sol</code>) stores elections, candidates, the voter allow-list, and the vote counts. <b>MetaMask + Ethers.js</b> sign the actual vote transaction in the voter's browser.</p>
        <p>The backend can create elections, add approved candidates and register eligible wallets, but it can never cast or change a vote. Results are read straight from the contract.</p>
      </Section>
      <Section title="Privacy and its limits">
        <p>No names, emails, voter IDs or other personal data are stored on-chain, only wallet addresses and opaque candidate numbers.</p>
        <p><b>Please note:</b> a public blockchain is transparent. Every vote transaction links a wallet address to a candidate, and anyone who learns which wallet belongs to a voter can see how they voted. This academic implementation therefore <b>does not provide ballot secrecy and is not a fully anonymous election</b>. The contract hides per-candidate tallies until the election ends, but that is only an interface-level rule, since raw transaction history stays public.</p>
        <p>Production-grade systems would add techniques such as commit-reveal schemes, blind signatures or zero-knowledge proofs (e.g. MACI or Semaphore) to address this.</p>
      </Section>
      <Section title="Technology"><p>React + Vite, Tailwind CSS, Recharts, Node.js, Express, MongoDB Atlas, Mongoose, JWT, bcrypt, Nodemailer, Solidity 0.8, OpenZeppelin, Hardhat, Ethers.js and MetaMask.</p></Section>
      <div className="text-center"><Link to="/how-it-works" className="btn-primary">How it works</Link></div>
    </div>
  );
}
