/** Utilitários partilhados para navegação hierárquica no menu P38. */

export function menuItemContainsPage(item, pageName, pathname = '') {
  if (!item) return false;
  const page = item.page;
  if (page && (pageName === page || pathname.includes(page))) return true;
  return (item.submenu || []).some((sub) => menuItemContainsPage(sub, pageName, pathname));
}

export function flattenMenuPages(menuItems, parentName = null) {
  const pages = [];
  for (const item of menuItems || []) {
    if (item.page) {
      pages.push({ name: item.name, page: item.page, icon: item.icon, parent: parentName });
    }
    for (const sub of item.submenu || []) {
      if (sub.page) {
        pages.push({ name: sub.name, page: sub.page, icon: sub.icon || item.icon, parent: item.name });
      }
      if (sub.submenu?.length) {
        pages.push(...flattenMenuPages(sub.submenu, sub.name));
      }
    }
  }
  return pages;
}

export function filterSubmenuByPermissoes(submenu, permissoes) {
  return (submenu || [])
    .map((sub) => {
      if (sub.submenu?.length) {
        const nested = filterSubmenuByPermissoes(sub.submenu, permissoes);
        if (!nested.length) return null;
        if (sub.permissaoCheck && !sub.permissaoCheck(permissoes)) return null;
        return { ...sub, submenu: nested };
      }
      if (sub.permissaoCheck && !sub.permissaoCheck(permissoes)) return null;
      return sub;
    })
    .filter(Boolean);
}
