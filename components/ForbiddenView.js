'use client';

import Link from 'next/link';

export default function ForbiddenView({
  title = '권한 없음',
  description = '이 페이지를 열 권한이 없거나 계정 권한을 확인할 수 없습니다.',
  actionHref = '/',
  actionLabel = '홈으로 이동',
  actionKind = 'link',
  onAction = null,
}) {
  const action = actionKind === 'button' ? (
    <button type="button" className="btn-primary" style={{ maxWidth: 220 }} onClick={onAction}>
      {actionLabel}
    </button>
  ) : (
    <Link href={actionHref} className="btn-primary" style={{ maxWidth: 220 }}>
      {actionLabel}
    </Link>
  );

  return (
    <div className="page-content flex-center" style={{ minHeight: '70vh', textAlign: 'center', gap: 14 }}>
      <h1 className="heading-md">{title}</h1>
      <p className="body-sm text-tertiary" style={{ maxWidth: 340, lineHeight: 1.5 }}>{description}</p>
      {action}
    </div>
  );
}
