import NoticeBanner from '../../components/ui/notice/NoticeBanner';

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 p-3 sm:p-6">
      <NoticeBanner limit={5} />
      {children}
    </div>
  );
}
