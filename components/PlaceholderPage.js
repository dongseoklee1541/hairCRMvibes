export default function PlaceholderPage({ title }) {
  return (
    <div className="flex-center" style={{ height: 'calc(100vh - 140px)', flexDirection: 'column', gap: 16 }}>
      <h2 className="heading-lg text-secondary">{title}</h2>
      <p className="body-md text-tertiary">준비 중인 기능입니다.</p>
    </div>
  );
}
