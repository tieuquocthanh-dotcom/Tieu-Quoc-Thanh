const fs = require('fs');
const file = 'components/QuotationManagement.tsx';
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
    content = content.replace("export const QuotationModal: React.FC<QuotationModalProps> = ({ item, products, suppliers, onClose, onSave }) => {", numericInputStr + "\nexport const QuotationModal: React.FC<QuotationModalProps> = ({ item, products, suppliers, onClose, onSave }) => {");
}

content = content.replace(
    /<input\s*type="text"\s*inputMode="numeric"\s*value=\{formatNumber\(price\)\}\s*onChange=\{e => setPrice\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\}\s*onFocus=\{e => e\.target\.select\(\)\}\s*className=\{inputClasses\}\s*required\s*\/>/g,
    `<NumericInput value={price} onChange={setPrice} className={inputClasses} />`
);

fs.writeFileSync(file, content);
