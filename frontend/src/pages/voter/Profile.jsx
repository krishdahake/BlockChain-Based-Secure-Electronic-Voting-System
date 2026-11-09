import { PageHeader, StatusBadge } from "../../components/ui";
import { useAuth } from "../../hooks/useAuth";
import WalletLinkCard from "../../components/WalletLinkCard";
import { fmtDate } from "../../utils/format";

export default function Profile() {
  const { user } = useAuth();
  const rows = [["Name", user.name], ["Email", user.email], ["Voter ID", user.voterId], ["Email verified", user.isEmailVerified ? "Yes" : "No"], ["Member since", fmtDate(user.createdAt)]];
  return (
    <>
      <PageHeader title="Profile settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h3 className="mb-4 font-semibold text-navy-900">Account</h3>
          <dl className="divide-y divide-slate-100 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between py-2.5"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-800">{v}</dd></div>)}
            <div className="flex justify-between py-2.5"><dt className="text-slate-500">Approval</dt><dd><StatusBadge status={user.approvalStatus} /></dd></div></dl>
          <p className="mt-4 text-xs text-slate-400">To change your name, email or voter ID, contact an administrator.</p></div>
        {user.isApproved && <WalletLinkCard />}
      </div>
    </>
  );
}
