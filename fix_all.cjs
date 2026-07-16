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

function inject(file, marker) {
    let content = fs.readFileSync(file, 'utf8');
    if (!content.includes('const NumericInput:')) {
        content = content.replace(marker, numericInputStr + "\n" + marker);
        fs.writeFileSync(file, content);
        console.log('Injected into', file);
    }
}

inject('components/AccountManagement.tsx', 'const AccountManagement: React.FC = () => {');
inject('components/SalesHistory.tsx', 'const SalesHistory: React.FC = () => {');
inject('components/QuotationManagement.tsx', 'export const QuotationModal: React.FC<QuotationModalProps> = ({');
inject('components/ProductManagement.tsx', 'export const ProductModal: React.FC<ProductModalProps> = ({');

