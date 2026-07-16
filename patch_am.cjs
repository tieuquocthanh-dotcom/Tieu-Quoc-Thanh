const fs = require('fs');
const file = 'components/AccountManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

const numericInputStr = `
const NumericInput: React.FC<{
    value: number;
    onChange: (val: number) => void;
    className?: string;
    placeholder?: string;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    onBlur?: () => void;
    isCurrency?: boolean;
    autoFocus?: boolean;
}> = ({ value, onChange, className, placeholder, onFocus, onBlur, isCurrency = true, autoFocus = false }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(isCurrency ? formatNumber(value) : value.toString());
        }
    }, [value, isFocused, isCurrency]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        setLocalValue(raw);
        onChange(Number(raw) || 0);
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={(e) => {
                setIsFocused(true);
                setLocalValue(value === 0 ? "" : value.toString());
                onFocus?.(e);
            }}
            onBlur={() => {
                setIsFocused(false);
                setLocalValue(isCurrency ? formatNumber(value) : value.toString());
                onBlur?.();
            }}
            onChange={handleChange}
        />
    );
};
`;

if (!content.includes('const NumericInput')) {
    content = content.replace("const AccountManagement: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {", numericInputStr + "\nconst AccountManagement: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {");
}

content = content.replace(
    /<input\s*type="text"\s*inputMode="numeric"\s*value=\{formatNumber\(amount\)\}\s*onChange=\{e => setAmount\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\}\s*className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none bg-white text-black"\s*\/>/g,
    `<NumericInput 
        value={amount} 
        onChange={setAmount}
        className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none bg-white text-black"
    />`
);

content = content.replace(
    /<input\s*type="text"\s*inputMode="numeric"\s*autoFocus\s*value=\{formatNumber\(newBalance\)\}\s*onChange=\{e => setNewBalance\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\}\s*onFocus=\{e => e\.target\.select\(\)\}\s*className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"\s*\/>/g,
    `<NumericInput 
        autoFocus
        value={newBalance} 
        onChange={setNewBalance}
        className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"
    />`
);

content = content.replace(
    /<input\s*type="text"\s*inputMode="numeric"\s*autoFocus\s*value=\{formatNumber\(amount\)\}\s*onChange=\{e => setAmount\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\}\s*onFocus=\{e => e\.target\.select\(\)\}\s*className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"\s*\/>/g,
    `<NumericInput 
        autoFocus
        value={amount} 
        onChange={setAmount}
        className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"
    />`
);

content = content.replace(
    /<input\s*type="text" inputMode="numeric"\s*value=\{formatNumber\(amount\)\}\s*onChange=\{e => \{\s*const maxBal = fromAccount \? Number\(fromAccount\.balance\) \|\| 0 : 9999999999;\s*const rawVal = e\.target\.value\.replace\(\/\\D\/g, ''\);\s*const numVal = parseInt\(rawVal, 10\) \|\| 0;\s*setAmount\(Math\.min\(numVal, maxBal\)\);\s*\}\}\s*onFocus=\{e => e\.target\.select\(\)\}\s*className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"\s*\/>/g,
    `<NumericInput 
        value={amount} 
        onChange={val => {
            const maxBal = fromAccount ? Number(fromAccount.balance) || 0 : 9999999999;
            setAmount(Math.min(val, maxBal));
        }}
        className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"
    />`
);

content = content.replace(
    /<input\s*type="text"\s*inputMode="numeric"\s*value=\{formatNumber\(initialBalance\)\}\s*onChange=\{e => setInitialBalance\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\}\s*onFocus=\{e => e\.target\.select\(\)\}\s*className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"\s*\/>/g,
    `<NumericInput 
        value={initialBalance} 
        onChange={setInitialBalance}
        className="w-full px-4 py-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-primary outline-none shadow-inner bg-white text-black"
    />`
);

fs.writeFileSync(file, content);
