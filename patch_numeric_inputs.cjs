const fs = require('fs');

const filesToPatch = [
    'components/AccountManagement.tsx',
    'components/CreateGoodsReceipt.tsx',
    'components/DebtManagement.tsx',
    'components/GoodsReceiptEditModal.tsx',
    'components/ProductManagement.tsx',
    'components/SaleEditModal.tsx',
    'components/SalesHistory.tsx',
    'components/SalesTerminal.tsx',
    'components/QuotationManagement.tsx'
];

const newNumericInput = `const NumericInput: React.FC<{
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
        const parsedLocal = parseNumber(localValue);
        if (value !== parsedLocal) {
             setLocalValue(isCurrency ? formatNumber(value) : value.toString());
        }
    }, [value, isCurrency, localValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        setLocalValue(raw);
        onChange(parseNumber(raw));
    };

    const handleBlur = (e?: React.FocusEvent<HTMLInputElement>) => {
        const parsed = parseNumber(localValue);
        setLocalValue(isCurrency ? formatNumber(parsed) : parsed.toString());
        if (onBlur) onBlur();
    };

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode={isCurrency ? "numeric" : "decimal"}
            value={localValue}
            placeholder={placeholder}
            className={className}
            onFocus={(e) => {
                if (value === 0) setLocalValue("");
                onFocus?.(e);
            }}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleBlur();
            }}
        />
    );
};`;

filesToPatch.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    const startIdx = content.indexOf('const NumericInput: React.FC<{');
    if (startIdx === -1) return;
    
    // Find the end of the component. It ends with `};` right before the next `const SomeComponent = ...` or `export default`
    // Let's just use string replacement carefully.
    
    const endStr = `        />\n    );\n};\n`;
    const endIdx = content.indexOf(endStr, startIdx);
    
    if (endIdx !== -1) {
        const before = content.substring(0, startIdx);
        const after = content.substring(endIdx + endStr.length);
        
        fs.writeFileSync(file, before + newNumericInput + '\n' + after);
        console.log(`Patched ${file}`);
    } else {
        console.log(`Could not find end of NumericInput in ${file}`);
    }
});
