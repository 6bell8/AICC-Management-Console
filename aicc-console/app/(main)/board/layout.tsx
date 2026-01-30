import NoticeBanner from '../../components/ui/notice/NoticeBanner';

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-4">
      <NoticeBanner limit={5} />
      {children}
    </div>
  );
}
