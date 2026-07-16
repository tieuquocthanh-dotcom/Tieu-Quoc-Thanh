const fs = require('fs');

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
    const [localValue, setLocalValue] = useState(isCurrency ? formatNumber(value) : value.toString());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    useEffect(() => {
        setLocalValue(isCurrency ? formatNumber(value) : value.toString());
    }, [value, isCurrency]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^0-9]/g, '');
        const num = Number(raw) || 0;
        setLocalValue(isCurrency ? formatNumber(num) : num.toString());
        onChange(num);
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
                if (value === 0) setLocalValue("");
                onFocus?.(e);
            }}
            onBlur={() => {
                setLocalValue(isCurrency ? formatNumber(value) : value.toString());
                onBlur?.();
            }}
            onChange={handleChange}
        />
    );
};
`;

let file = 'components/QuotationManagement.tsx';
let content = fs.readFileSync(file, 'utf8');
if (!content.includes('const NumericInput:')) {
    content = content.replace('const QuotationModal: React.FC', numericInputStr + "\nconst QuotationModal: React.FC");
    fs.writeFileSync(file, content);
}

