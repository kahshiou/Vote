import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from './ui';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { generateRandomCode } from '../lib/utils';
import { CANDIDATES } from '../data';
import { LogOut, RefreshCcw, Download, Copy, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export function AdminDashboard({ adminHash, onLogout }: { adminHash: string, onLogout: () => void }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');

  const fetchVault = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, 'admin_vault', adminHash);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const _data = snapshot.data();
        setData(_data);
      } else {
        setData(null);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'admin_vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVault();
  }, [adminHash]);

  const generateCodes = async () => {
    if (data && data.voters.length > 0 && !confirm("注意：已經有生成的代碼了。重新產生將會覆蓋現有代碼並使得現有投票作廢！確定嗎？")) return;
    
    if (!newDate || !newTime) {
      alert("請先設定正確的截止日期與時間");
      return;
    }
    
    const endDateTime = new Date(`${newDate}T${newTime}:00`);
    const endTimestamp = endDateTime.toISOString();

    const voters = Array.from({ length: 9 }).map((_, i) => ({
      name: `投票者 ${i + 1}`,
      code: generateRandomCode(8),
      isTest: false
    }));
    
    // Add 1 test user
    const testVoters = [{
      name: "測試用",
      code: "TEST-" + generateRandomCode(4),
      isTest: true
    }];

    const vaultData = {
      pollTitle: "彰化縣立成功高級中學 續任投票",
      endTime: endTimestamp,
      voters,
      testVoters
    };

    try {
      await setDoc(doc(db, 'admin_vault', adminHash), vaultData);
      
      // We also need to PRE-CREATE the voter documents so the rules allow them to be updated
      const allVoters = [...voters, ...testVoters];
      const batchPromises = allVoters.map((v) => {
        return setDoc(doc(db, 'voters', v.code), {
          status: 'pending',
          choices: {},
          updatedAt: new Date().toISOString(),
          endTime: endTimestamp,
          isTest: v.isTest
        });
      });
      await Promise.all(batchPromises);

      setData(vaultData);
      alert("登入連結與系統已準備完成！");
    } catch(e) {
      handleFirestoreError(e, OperationType.WRITE, 'admin_vault / voters');
    }
  };

  const updateDeadline = async () => {
     if (!newDate || !newTime || !data) return;
     const endDateTime = new Date(`${newDate}T${newTime}:00`);
     const endTimestamp = endDateTime.toISOString();
     try {
       await updateDoc(doc(db, 'admin_vault', adminHash), { endTime: endTimestamp });
       const allVoters = [...data.voters, ...(data.testVoters || [])];
       await Promise.all(allVoters.map((v:any) => updateDoc(doc(db, 'voters', v.code), { endTime: endTimestamp })));
       fetchVault();
       alert("時間已更新！");
     } catch (e) {
       handleFirestoreError(e, OperationType.UPDATE, 'admin_vault / voters');
     }
  };

  // 觀看結果
  const [results, setResults] = useState<any>(null);
  
  // URL Help generator
  const getPublicLink = (code: string) => {
    // Determine the actual app origin
    let origin = import.meta.env.VITE_APP_URL || window.location.origin;
    
    // Fallback: If for some reason we're inside the AI Studio frame without VITE_APP_URL
    if (origin.includes('aistudio.google.com')) {
       origin = "YOUR_SHARED_APP_URL";
    }
    return `${origin}/?code=${code}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => alert('已複製連結！'));
  };

  const calculateResults = async () => {
    if (!data) return;
    try {
      const isEnded = new Date() >= new Date(data.endTime);
      if (!isEnded) {
        if (!confirm("時間尚未截止！強制提早計票嗎？（不建議）")) {
          return;
        }
      }
      
      setLoading(true);
      const allProms = data.voters.map((v: any) => getDoc(doc(db, 'voters', v.code)));
      const snapshots = await Promise.all(allProms);
      
      let tally: Record<string, Record<string, number>> = {};
      CANDIDATES.forEach(c => { tally[c] = { "approve": 0, "disapprove": 0, "none": 0 }; });
      
      let votedCount = 0;
      
      snapshots.forEach((snap, idx) => {
        if(snap.exists()) {
           const vData = snap.data();
           if(vData.status === 'voted') {
             votedCount++;
             Object.entries(vData.choices).forEach(([cand, choice]: [string, any]) => {
                if(tally[cand] && tally[cand][choice] !== undefined) {
                  tally[cand][choice]++;
                }
             });
           }
        }
      });
      
      setResults({
        totalExpected: data.voters.length,
        votedCount,
        tally
      });
      setLoading(false);
      
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'voters');
      setLoading(false);
    }
  };
  
  const exportCsv = () => {
    if (!results) return;
    let csv = "候選人,贊成續任(票),不贊成續任(票),無意見(票),結果\n";
    
    CANDIDATES.forEach(c => {
      const approve = results.tally[c]['approve'] || 0;
      const disapprove = results.tally[c]['disapprove'] || 0;
      const none = results.tally[c]['none'] || 0;
      const pass = approve >= 6 ? "達標" : "未達標";
      csv += `"${c}",${approve},${disapprove},${none},${pass}\n`;
    });
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: "text/csv;charset=utf-8;" }); // Add BOM for excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `投票結果_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (loading && !data) return <div className="p-8 text-center text-slate-500">載入中...</div>;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-blue-900 text-white p-4 rounded-xl shadow-md">
        <div>
          <h2 className="text-xl font-bold">成功高級中學 - 續任投票後台系統</h2>
          <p className="text-sm text-blue-200">登入為管理者: kahshiou@gmail.com</p>
        </div>
        <Button variant="outline" className="text-blue-900 border-none px-3" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-2" /> 登出
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>系統設定與名單產生</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           {!data ? (
             <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                <p className="text-slate-600">目前尚無建立任何投票代碼，請先設定截止時間並建立。</p>
                <div className="flex space-x-2">
                  <Input type="date" className="w-40" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  <Input type="time" className="w-32" value={newTime} onChange={e => setNewTime(e.target.value)} />
                </div>
                <Button onClick={generateCodes}>產生 9 組專屬投票連結</Button>
             </div>
           ) : (
             <div className="space-y-6">
                <div>
                  <h4 className="font-medium text-slate-800 mb-2">投票截止時間</h4>
                  <div className="flex space-x-2 items-center">
                    <Input type="date" className="w-40" defaultValue={new Date(data.endTime).toISOString().split('T')[0]} onChange={e => setNewDate(e.target.value)} />
                    <Input type="time" className="w-32" defaultValue={new Date(data.endTime).toISOString().split('T')[1].substring(0,5)} onChange={e => setNewTime(e.target.value)} />
                    <Button variant="outline" onClick={updateDeadline}>更新時間</Button>
                  </div>
                </div>
                
                <div>
                   <div className="flex items-center space-x-2 mb-2 border-l-4 border-l-amber-500 bg-amber-50 p-3 rounded text-sm text-amber-900">
                      <AlertTriangle className="w-5 h-5" />
                      <p>
                        <strong>無法開啟？請注意：</strong> 在傳送連結之前，請務必確認您已點擊 AI Studio 右上角的 <strong>「Share (分享)」</strong> 按鈕並發佈應用程式，這樣投票者才不會看到 403 錯誤。以下連結已自動為您轉換為發佈格式。
                      </p>
                   </div>
                   <h4 className="font-medium text-slate-800 mb-2 mt-4">
                      請複製以下專屬連結，並透過 LINE 或 Email 發送給投票者即可：
                   </h4>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                     {data.voters.map((v:any, idx:number) => {
                       const link = getPublicLink(v.code);
                       return (
                         <div key={idx} className="p-3 border rounded border-slate-200 text-sm bg-white shadow-sm flex flex-col justify-between">
                           <div className="break-all font-mono text-slate-700 mb-2">{link}</div>
                           <Button variant="outline" className="w-full text-xs h-7" onClick={() => copyToClipboard(link)}>
                             <Copy className="w-3 h-3 mr-2" /> 複製給 {v.name}
                           </Button>
                         </div>
                       );
                     })}
                   </div>
                </div>

                {data.testVoters && (
                  <div>
                    <h4 className="font-medium text-slate-800 mb-2 mt-6">測試用連結 (此連結之投票不計入正式結果)</h4>
                    <div className="p-3 border rounded border-amber-200 text-sm font-mono bg-amber-50 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                       <span className="break-all">{getPublicLink(data.testVoters[0].code)}</span>
                       <div className="flex space-x-2 shrink-0">
                         <Button variant="outline" className="h-7 text-xs bg-white" onClick={() => copyToClipboard(getPublicLink(data.testVoters[0].code))}>
                            <Copy className="w-3 h-3 mr-1" /> 複製
                         </Button>
                         <Button variant="default" className="h-7 text-xs" onClick={() => window.open(getPublicLink(data.testVoters[0].code), '_blank')}>
                            開啟測試
                         </Button>
                       </div>
                    </div>
                  </div>
                )}
             </div>
           )}
        </CardContent>
      </Card>
      
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>投票結果</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center space-x-4">
                <Button onClick={calculateResults} disabled={loading}>
                   <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                   計算並顯示結果
                </Button>
                {results && (
                   <Button variant="outline" onClick={exportCsv}>
                     <Download className="w-4 h-4 mr-2" /> 匯出報表 (CSV)
                   </Button>
                )}
             </div>
             
             {results && (
                <div className="mt-6 space-y-4">
                   <div className="bg-slate-100 p-4 rounded font-medium text-slate-700">
                     總投票人數: {results.votedCount} / {results.totalExpected} (包含您自己)
                   </div>
                   
                   <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm whitespace-nowrap">
                       <thead>
                         <tr className="border-b border-slate-200 bg-slate-50">
                           <th className="p-3">候選人</th>
                           <th className="p-3">贊成續任</th>
                           <th className="p-3">不贊成續任</th>
                           <th className="p-3">無意見</th>
                           <th className="p-3">結果判定</th>
                         </tr>
                       </thead>
                       <tbody>
                         {CANDIDATES.map((cand, idx) => {
                           const approve = results.tally[cand]['approve'] || 0;
                           const pass = approve >= 6;
                           return (
                             <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                               <td className="p-3 font-medium">{cand}</td>
                               <td className="p-3 text-green-600 font-semibold">{approve}</td>
                               <td className="p-3 text-red-500">{results.tally[cand]['disapprove'] || 0}</td>
                               <td className="p-3 text-slate-500">{results.tally[cand]['none'] || 0}</td>
                               <td className="p-3">
                                 {pass ? (
                                   <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">符合提報資格</span>
                                 ) : (
                                   <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-xs">未達標</span>
                                 )}
                               </td>
                             </tr>
                           )
                         })}
                       </tbody>
                     </table>
                   </div>
                </div>
             )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
