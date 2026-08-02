const fs = require('fs');
const file = 'components/RestockPredictions.tsx';
let code = fs.readFileSync(file, 'utf8');

const tdOld = `                                            <td className="px-4 py-4 text-right">
                                                <span className={\`font-black \${p.totalStock <= 0 ? 'text-red-500' : 'text-slate-700'}\`}>
                                                    {formatNumber(p.totalStock)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="font-black text-blue-600">{formatNumber(p.soldInPeriod)}</div>
                                                <div className="text-[10px] font-bold text-slate-400">~{p.salesVelocity.toFixed(1)} / ngày</div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={\`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border \${statusInfo.color}\`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {p.daysRemaining === Infinity ? (
                                                    <span className="text-slate-400 font-medium">-</span>
                                                ) : (
                                                    <span className={\`font-black \${p.daysRemaining <= 7 ? 'text-red-500' : p.daysRemaining <= 15 ? 'text-orange-500' : 'text-slate-700'}\`}>
                                                        {formatNumber(Math.floor(p.daysRemaining))} ngày
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right bg-primary/5">
                                                {p.suggestedRestockQty > 0 ? (
                                                    <span className="font-black text-primary text-base">
                                                        +{formatNumber(p.suggestedRestockQty)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">-</span>
                                                )}
                                            </td>`;

const tdNew = `                                            <td className="px-4 py-4 text-right">
                                                <span className={\`font-black \${p.totalStock <= 0 ? 'text-red-500' : 'text-slate-700'}\`}>
                                                    {formatNumber(p.totalStock)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <span className="font-black text-slate-700">
                                                    {formatNumber(p.totalStock * (p.importPrice || 0))}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="font-black text-blue-600">{formatNumber(p.soldInPeriod)}</div>
                                                <div className="text-[10px] font-bold text-slate-400">~{p.salesVelocity.toFixed(1)} / ngày</div>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                <span className={\`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border \${statusInfo.color}\`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                {p.daysRemaining === Infinity ? (
                                                    <span className="text-slate-400 font-medium">-</span>
                                                ) : (
                                                    <span className={\`font-black \${p.daysRemaining <= 7 ? 'text-red-500' : p.daysRemaining <= 15 ? 'text-orange-500' : 'text-slate-700'}\`}>
                                                        {formatNumber(Math.floor(p.daysRemaining))} ngày
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right bg-primary/5">
                                                {p.suggestedRestockQty > 0 ? (
                                                    <span className="font-black text-primary text-base">
                                                        +{formatNumber(p.suggestedRestockQty)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right bg-primary/5">
                                                {p.suggestedRestockQty > 0 ? (
                                                    <span className="font-black text-primary text-base">
                                                        {formatNumber(p.suggestedRestockQty * (p.importPrice || 0))}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold">-</span>
                                                )}
                                            </td>`;

code = code.replace(tdOld, tdNew);

fs.writeFileSync(file, code);
console.log('Done TD');
