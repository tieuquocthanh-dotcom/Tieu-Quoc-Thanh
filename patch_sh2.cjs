const fs = require('fs');
const file = 'components/SalesHistory.tsx';
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
}> = ({ value, onChange, className, placeholder, onFocus, onBlur, isCurrency = true }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState("");

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
    content = content.replace("const SalesHistory: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {", numericInputStr + "\nconst SalesHistory: React.FC<{ userRole?: 'admin' | 'staff' | null }> = ({ userRole }) => {");
}

content = content.replace(
    /<input\s*type="text" inputMode="numeric"\s*value=\{formatNumber\(payAmount\)\}\s*onChange=\{e => setPayAmount\(Math\.min\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0, remaining\)\)\}\s*className="w-full p-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 bg-white shadow-inner"\s*onFocus=\{e => e\.target\.select\(\)\}\s*\/>/,
    `<NumericInput 
                                value={payAmount} 
                                onChange={val => setPayAmount(Math.min(val, remaining))} 
                                className="w-full p-3 border-2 border-slate-800 rounded-xl text-right font-black text-2xl focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 bg-white shadow-inner"
                            />`
);

fs.writeFileSync(file, content);
