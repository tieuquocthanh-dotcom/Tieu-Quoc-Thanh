const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /const NavItem: React\.FC<\{([\s\S]*?)\}> = \(\{ targetView, icon, label, disabled = false, onClick \}\) => \{/,
    `const NavItem: React.FC<{$1\n    badgeCount?: number;\n  }> = ({ targetView, icon, label, disabled = false, onClick, badgeCount = 0 }) => {`
);

code = code.replace(
    /<span className="hidden md:inline">\{label\}<\/span>\n\s*<\/button>/,
    `<span className="hidden md:inline">{label}</span>\n        {badgeCount > 0 && (\n          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm flex items-center justify-center">\n            {badgeCount > 99 ? '99+' : badgeCount}\n          </span>\n        )}\n      </button>`
);

code = code.replace(
    "const baseClasses = 'flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium';",
    "const baseClasses = 'flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium relative';"
);

fs.writeFileSync('App.tsx', code);
