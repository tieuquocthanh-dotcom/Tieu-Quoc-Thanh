const fs = require('fs');
const file = 'components/DebtManagement.tsx';
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
    content = content.replace("const DebtManagement: React.FC = () => {", numericInputStr + "\nconst DebtManagement: React.FC = () => {");
}

content = content.replace(
    /<input\s+type="text" inputMode="numeric"\s+value=\{formatNumber\(payAmount\)\}\s+onChange=\{\(e\) => setPayAmount\(Math\.min\(parseNumber\(e\.target\.value\), remainingDebt\)\)\}\s+onFocus=\{\(e\) => e\.target\.select\(\)\}\s+className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"\s+\/>/,
    `<NumericInput 
        value={payAmount} 
        onChange={(val) => setPayAmount(Math.min(val, remainingDebt))}
        className="w-full px-4 py-3 bg-slate-900 text-white border-2 border-slate-800 rounded-xl font-black text-2xl text-right focus:border-primary outline-none shadow-inner"
    />`
);

fs.writeFileSync(file, content);
console.log('Patched DebtManagement');
