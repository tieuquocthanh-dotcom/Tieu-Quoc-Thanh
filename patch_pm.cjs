const fs = require('fs');
const file = 'components/ProductManagement.tsx';
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
    content = content.replace("export const ProductModal: React.FC<ProductModalProps> = ({ product, manufacturers, onClose, onSave, existingNames, allProductsForCombo = [] }) => {", numericInputStr + "\nexport const ProductModal: React.FC<ProductModalProps> = ({ product, manufacturers, onClose, onSave, existingNames, allProductsForCombo = [] }) => {");
}

content = content.replace(
    /<input type="text" inputMode="numeric" value=\{formatNumber\(importPrice\)\} onChange=\{e => setImportPrice\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\} onFocus=\{e => e\.target\.select\(\)\} className=\{`\$\{inputClasses\} font-black text-slate-600`\} required \/>/g,
    `<NumericInput value={importPrice} onChange={setImportPrice} className={\`\${inputClasses} font-black text-slate-600\`} />`
);

content = content.replace(
    /<input type="text" inputMode="numeric" value=\{formatNumber\(sellingPrice\)\} onChange=\{e => setSellingPrice\(parseInt\(e\.target\.value\.replace\(\/\\D\/g, ''\), 10\) \|\| 0\)\} onFocus=\{e => e\.target\.select\(\)\} className=\{`\$\{inputClasses\} font-black text-primary`\} required \/>/g,
    `<NumericInput value={sellingPrice} onChange={setSellingPrice} className={\`\${inputClasses} font-black text-primary\`} />`
);

fs.writeFileSync(file, content);
