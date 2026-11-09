import { Navigate, Route, Routes } from "react-router-dom";
import { LayoutDashboard, Vote, ListChecks, Receipt, BarChart3, UserCog, Users, UserCheck, ClipboardList, CalendarPlus, CalendarCog, Link2, LineChart, ScrollText, Info, FileText } from "lucide-react";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing from "./pages/public/Landing";
import About from "./pages/public/About";
import HowItWorks from "./pages/public/HowItWorks";
import Register from "./pages/public/Register";
import VerifyOtp from "./pages/public/VerifyOtp";
import Login from "./pages/public/Login";
import Contact from "./pages/public/Contact";

import VoterOverview from "./pages/voter/Overview";
import VoterElections from "./pages/voter/Elections";
import ElectionDetails from "./pages/voter/ElectionDetails";
import VotingStatus from "./pages/voter/VotingStatus";
import VoterTransactions from "./pages/voter/Transactions";
import Results from "./pages/voter/Results";
import VoterProfile from "./pages/voter/Profile";

import AdminOverview from "./pages/admin/Overview";
import Voters from "./pages/admin/Voters";
import Candidates from "./pages/admin/Candidates";
import AdminElections from "./pages/admin/Elections";
import ElectionForm from "./pages/admin/ElectionForm";
import AdminTransactions from "./pages/admin/Transactions";
import Analytics from "./pages/admin/Analytics";

import CandidateStatus from "./pages/candidate/Status";
import EditPage from "./pages/candidate/EditPage";
import ElectionInfo from "./pages/candidate/ElectionInfo";

const voterNav = [
  { to: "/voter", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/voter/elections", label: "Elections", icon: Vote },
  { to: "/voter/status", label: "My voting status", icon: ListChecks },
  { to: "/voter/transactions", label: "Transactions", icon: Receipt },
  { to: "/voter/results", label: "Results", icon: BarChart3 },
  { to: "/voter/profile", label: "Profile", icon: UserCog },
];
const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/voters", label: "Registered voters", icon: Users, end: true },
  { to: "/admin/voters/pending", label: "Pending approvals", icon: UserCheck },
  { to: "/admin/candidates", label: "Candidate approvals", icon: ClipboardList },
  { to: "/admin/elections", label: "Manage elections", icon: CalendarCog, end: true },
  { to: "/admin/elections/new", label: "Create election", icon: CalendarPlus },
  { to: "/admin/transactions", label: "Blockchain txs", icon: Link2 },
  { to: "/admin/analytics", label: "Analytics", icon: LineChart },
  { to: "/admin/results", label: "Results", icon: BarChart3 },
];
const candidateNav = [
  { to: "/candidate", label: "Application status", icon: LayoutDashboard, end: true },
  { to: "/candidate/profile", label: "Profile", icon: UserCog },
  { to: "/candidate/elections", label: "Election info", icon: Info },
  { to: "/candidate/manifesto", label: "Manifesto", icon: ScrollText },
];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/register/voter" element={<Register role="voter" />} />
        <Route path="/register/candidate" element={<Register role="candidate" />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      <Route element={<ProtectedRoute roles={["voter"]} />}>
        <Route path="/voter" element={<DashboardLayout nav={voterNav} title="Voter" />}>
          <Route index element={<VoterOverview />} />
          <Route path="elections" element={<VoterElections />} />
          <Route path="elections/:id" element={<ElectionDetails />} />
          <Route path="status" element={<VotingStatus />} />
          <Route path="transactions" element={<VoterTransactions />} />
          <Route path="results" element={<Results />} />
          <Route path="profile" element={<VoterProfile />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin" element={<DashboardLayout nav={adminNav} title="Administration" />}>
          <Route index element={<AdminOverview />} />
          <Route path="voters" element={<Voters key="all" />} />
          <Route path="voters/pending" element={<Voters key="pending" initial="pending" />} />
          <Route path="candidates" element={<Candidates />} />
          <Route path="elections" element={<AdminElections />} />
          <Route path="elections/new" element={<ElectionForm />} />
          <Route path="elections/:id/edit" element={<ElectionForm />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="results" element={<Results admin />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={["candidate"]} />}>
        <Route path="/candidate" element={<DashboardLayout nav={candidateNav} title="Candidate" />}>
          <Route index element={<CandidateStatus />} />
          <Route path="profile" element={<EditPage fields="profile" />} />
          <Route path="elections" element={<ElectionInfo />} />
          <Route path="manifesto" element={<EditPage fields="manifesto" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
