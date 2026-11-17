'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AREAS } from './roles';
import { useRole } from './SiteHeader';

/** Pages that bring their own full-screen layout keep the header but skip the sidebar. */
const FULL_WIDTH = ['/', '/claim'];

export function SideNav() {
  const path = usePathname() || '/';
  const role = useRole();
  if (FULL_WIDTH.includes(path) || !role) return null;
  const area = AREAS[role];
  return (
    <aside className={`ob-side ob-${role}`} aria-label={`${area.label} pages`}>
      <div className="ob-side-title">{area.label}</div>
      <nav>
        {area.links.map(({ href, icon: Icon, label, hint }) => {
          const on = path === href || (path.startsWith(href + '/') && href !== '/commerce');
          return (
            <Link key={href} href={href} title={hint} aria-current={on ? 'page' : undefined}>
              <Icon size={17} strokeWidth={2} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
