const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    "import { doc, onSnapshot as onDocSnapshot, setDoc } from 'firebase/firestore';",
    "import { doc, onSnapshot as onDocSnapshot, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';"
);

const newLogic = `
  const [unreadSalesCount, setUnreadSalesCount] = useState(0);
  const [unreadReceiptsCount, setUnreadReceiptsCount] = useState(0);

  const [lastViewedSales, setLastViewedSales] = useState(() => parseInt(localStorage.getItem('lastViewedSales') || Date.now().toString()));
  const [lastViewedReceipts, setLastViewedReceipts] = useState(() => parseInt(localStorage.getItem('lastViewedReceipts') || Date.now().toString()));

  useEffect(() => {
      if (view === 'sales') {
          const now = Date.now();
          setLastViewedSales(now);
          localStorage.setItem('lastViewedSales', now.toString());
      }
      if (view === 'goodsReceipt') {
          const now = Date.now();
          setLastViewedReceipts(now);
          localStorage.setItem('lastViewedReceipts', now.toString());
      }
  }, [view]);

  useEffect(() => {
      if (!user) return;
      const q = query(collection(db, 'sales'), where('createdAt', '>', new Date(lastViewedSales)));
      const unsub = onSnapshot(q, (snap) => setUnreadSalesCount(snap.docs.length));
      return () => unsub();
  }, [user, lastViewedSales]);

  useEffect(() => {
      if (!user) return;
      const q = query(collection(db, 'goodsReceipts'), where('createdAt', '>', new Date(lastViewedReceipts)));
      const unsub = onSnapshot(q, (snap) => setUnreadReceiptsCount(snap.docs.length));
      return () => unsub();
  }, [user, lastViewedReceipts]);

  useEffect(() => {
      const total = unreadSalesCount + unreadReceiptsCount;
      try {
          if (total > 0) {
              if (navigator && 'setAppBadge' in navigator) {
                  (navigator as any).setAppBadge(total).catch((e: any) => console.error("AppBadge Error:", e));
              }
          } else {
              if (navigator && 'clearAppBadge' in navigator) {
                  (navigator as any).clearAppBadge().catch((e: any) => console.error("AppBadge Error:", e));
              }
          }
      } catch(e) {
          console.error("AppBadge Sync Error:", e);
      }
  }, [unreadSalesCount, unreadReceiptsCount]);

  const handleLogout = async () => {`;

code = code.replace("  const handleLogout = async () => {", newLogic);

fs.writeFileSync('App.tsx', code);
