const fs = require('fs');
const file = 'components/CreateGoodsReceipt.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldState = `    const [isSaving, setIsSaving] = useState(false);`;
const newState = `    const [isSaving, setIsSaving] = useState(false);
    const [isNameExpanded, setIsNameExpanded] = useState(false);`;
code = code.replace(oldState, newState);

const oldName = `                    <div className="font-black text-black leading-tight line-clamp-2 text-[12px] mb-1 cursor-pointer transition-all hover:line-clamp-none" title={product.name}>{product.name}</div>`;
const newName = `                    <div 
                        className={\`font-black text-black leading-tight text-[12px] mb-1 cursor-pointer transition-all \${isNameExpanded ? '' : 'line-clamp-2 hover:line-clamp-none'}\`}
                        title={product.name}
                        onClick={() => setIsNameExpanded(!isNameExpanded)}
                    >
                        {product.name}
                    </div>`;
code = code.replace(oldName, newName);

fs.writeFileSync(file, code);
console.log('Done');
