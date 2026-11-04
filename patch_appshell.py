import sys

path = r'c:\Users\Sai Harsha\Desktop\ticket\src\components\AppShell.tsx'
content = open(path, encoding='utf-8').read()

# File uses LF (\n) not CRLF 
old = (
    '        <header className="topbar">\n'
    '          <button\n'
    '            className="btn btn-ghost btn-sm menu-btn"\n'
    '            aria-label="Open navigation"\n'
    '            onClick={() => setMenuOpen(true)}\n'
    '          >\n'
    '            <Icon name="menu" size={18} />\n'
    '          </button>\n'
    '          <span className="topbar-title">{titleFor(location.pathname)}</span>\n'
    '          <span className="topbar-spacer" />\n'
    '          {(role === "customer" || role === "admin") && (\n'
    '            <NavLink to="/tickets/new" className="btn btn-primary btn-sm hide-sm">\n'
    '              <Icon name="plus" size={14} />\n'
    '              New ticket\n'
    '            </NavLink>\n'
    '          )}\n'
    '        </header>'
)

new = (
    '        {/* Incident Correlation Outage Banner */}\n'
    '        {outageCount >= 3 && (\n'
    '          <div style={{ background: "#fef2f2", borderBottom: "2px solid #ef4444", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12 }}>\n'
    '            <span style={{ fontSize: 20 }}>🚨</span>\n'
    '            <div style={{ flex: 1 }}>\n'
    '              <strong style={{ color: "#dc2626" }}>Possible System-Wide Incident</strong>\n'
    '              <span style={{ color: "#6b7280", marginLeft: 8 }}>{outageCount} tickets with outage keywords in the last 10 min.</span>\n'
    '            </div>\n'
    '            <NavLink to="/tickets" style={{ background: "#dc2626", color: "#fff", padding: "5px 14px", borderRadius: 6, fontSize: 12.5, textDecoration: "none", fontWeight: 600 }}>View Tickets</NavLink>\n'
    '          </div>\n'
    '        )}\n'
    '\n'
    '        <header className="topbar">\n'
    '          <button\n'
    '            className="btn btn-ghost btn-sm menu-btn"\n'
    '            aria-label="Open navigation"\n'
    '            onClick={() => setMenuOpen(true)}\n'
    '          >\n'
    '            <Icon name="menu" size={18} />\n'
    '          </button>\n'
    '          <span className="topbar-title">{titleFor(location.pathname)}</span>\n'
    '          <span className="topbar-spacer" />\n'
    '          <button className="btn btn-ghost btn-sm hide-sm" onClick={() => setSearchOpen(true)} style={{ color: "#64748b", fontSize: 13 }} title="Search tickets (Ctrl+K)">\n'
    '            \xf0\x9f\x94\x8d <span style={{ fontSize: 10, background: "#f1f5f9", padding: "1px 6px", borderRadius: 3, color: "#94a3b8", marginLeft: 3 }}>Ctrl K</span>\n'
    '          </button>\n'
    '          {role === "customer" && (\n'
    '            <NavLink to="/tickets/new" className="btn btn-primary btn-sm hide-sm">\n'
    '              <Icon name="plus" size={14} />\n'
    '              New ticket\n'
    '            </NavLink>\n'
    '          )}\n'
    '        </header>'
)

if old in content:
    content = content.replace(old, new)
    open(path, 'w', encoding='utf-8').write(content)
    print('SUCCESS')
else:
    print('NOT FOUND - trying with && encoded')
    old2 = old.replace('&&', '&amp;&amp;')
    if old2 in content:
        content = content.replace(old2, new)
        open(path, 'w', encoding='utf-8').write(content)
        print('SUCCESS with encoded &&')
    else:
        # Try to find actual text around topbar-spacer
        idx = content.find('topbar-spacer')
        chunk = content[idx-300:idx+500]
        print(repr(chunk))
        sys.exit(1)
