'use client';

import Link from 'next/link';

export default function ForbiddenView({
  title = '접근 제한',
  description = '현재 계정으로는 이 페이지를 이용할 수 없습니다.',
  actionHref = '/',
  actionLabel = '홈으로 이동',
}) {
  return (
    <div className="page-content flex-center" style={{ minHeight: '70vh', textAlign: 'center', gap: 14 }}>
      <h1 className="heading-md">{title}</h1>
      <p className="body-sm text-tertiary">{description}</p>
      <Link href={actionHref} className="btn-primary" style={{ maxWidth: 220 }}>
        {actionLabel}
      </Link>
    </div>
  );
}
