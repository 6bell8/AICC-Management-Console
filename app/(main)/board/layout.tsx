import NoticeBanner from '../../components/ui/notice/NoticeBanner';

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="board-wide-shell space-y-4" data-main-width="board-wide">
      <NoticeBanner limit={5} />
      {children}
    </div>
  );
}
