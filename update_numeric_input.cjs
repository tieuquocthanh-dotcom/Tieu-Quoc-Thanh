const fs = require('fs');
const path = require('path');

function getFiles(dir) {
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    });
    return Array.prototype.concat(...files);
}

const files = getFiles('components').filter(f => f.endsWith('.tsx'));

const newNumericInput = `
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
`.trim();

for (const f of files) {
    let c = fs.readFileSync(f, 'utf8');
    let changed = false;
    
    const replaceRegexWithRef = /const NumericInput: React\.FC<\{[\s\S]*?onChange=\{handleChange\}\s*\/>\s*\);\s*\};/;
    if (replaceRegexWithRef.test(c)) {
        c = c.replace(replaceRegexWithRef, newNumericInput);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(f, c);
        console.log('Updated NumericInput in', f);
    }
}
