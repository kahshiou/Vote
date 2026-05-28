import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from './ui';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { CANDIDATES, OPTIONS } from '../data';
import { format } from 'date-fns';

export function VoterApp({ code }: { code: string }) {
  const [loading, setLoading] = useState(true);
  const [voterData, setVoterData] = useState<any>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchVoter = async () => {
      try {
        const docRef = doc(db, 'voters', code);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          setVoterData(data);
          if (data.choices) {
             setChoices(data.choices);
          }
        } else {
          setVoterData(false); // not found
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, 'voters');
        setVoterData(false);
      } finally {
        setLoading(false);
      }
    };
    fetchVoter();
  }, [code]);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center text-slate-500">載入中...</div>;
  }

  if (voterData === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center py-8">
          <p className="text-red-500 font-medium">無效的專屬投票連結！</p>
          <p className="text-slate-500 text-sm mt-2">請確認您的網址是否正確，或聯絡管理員。</p>
        </Card>
      </div>
    );
  }
  
  const isExpired = new Date() > new Date(voterData.endTime);

  const handleChoice = (cand: string, val: string) => {
    if (isExpired) return;
    setChoices(prev => ({ ...prev, [cand]: val }));
  };

  const submitVote = async () => {
    // Check if fully answered
    const unanswered = CANDIDATES.filter(c => !choices[c]);
    if (unanswered.length > 0) {
      alert(`您還有 ${unanswered.length} 位人選尚未圈選！請全部圈選後再送出。`);
      return;
    }
    
    if (!confirm("確定要送出您的投票嗎？\n(在截止時間前，您都可透過此專屬連結隨時回來重新修改投票)")) return;

    setSaving(true);
    try {
       await updateDoc(doc(db, 'voters', code), {
          status: 'voted',
          choices,
          updatedAt: new Date().toISOString()
       });
       alert("投票成功送出！");
       // Update local state
       setVoterData(prev => ({ ...prev, status: 'voted' }));
    } catch(e) {
       handleFirestoreError(e, OperationType.UPDATE, 'voters');
       alert((e as Error).message);
    } finally {
       setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 font-sans">
      <div className="w-full max-w-3xl mx-auto space-y-6">
         
         <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-bold text-blue-900 tracking-tight">彰化縣立成功高級中學</h1>
            <h2 className="text-xl font-medium text-slate-700">教師續任投票系統</h2>
            {voterData.isTest && (
              <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold mt-2">
                 此為測試環境，不計入正式報表
              </div>
            )}
         </div>

         <Card className="border-t-4 border-t-blue-900 shadow-sm">
           <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-center space-y-4 md:space-y-0">
                 <div>
                    <h3 className="font-semibold text-lg text-slate-800">投票狀態</h3>
                    <p className="text-sm text-slate-500">
                      您的狀態：
                      {voterData.status === 'pending' ? (
                        <span className="text-amber-600 font-bold ml-1">尚未完成</span>
                      ) : (
                        <span className="text-green-600 font-bold ml-1">已送出投票</span>
                      )}
                    </p>
                 </div>
                 <div className="md:text-right bg-blue-50 px-4 py-3 rounded-lg">
                    <p className="text-xs text-blue-800 font-bold uppercase tracking-wider mb-1">系統將於以下時間自動鎖定並開票</p>
                    <p className="text-sm font-mono text-slate-800 font-medium">
                      {format(new Date(voterData.endTime), 'yyyy-MM-dd HH:mm:ss')} 截止
                    </p>
                    {isExpired && (
                      <p className="text-red-500 text-sm font-bold mt-1">投票已截止</p>
                    )}
                 </div>
              </div>
              
              {!isExpired && (
                <div className="mt-4 p-3 bg-slate-100 rounded text-sm text-slate-600">
                   提示：即使您已送出投票，在截止時間前，您都可以隨時透過本連結再次修改意向。
                </div>
              )}
           </CardContent>
         </Card>

         <div className="space-y-4">
            <h3 className="font-semibold text-slate-800 px-1 border-b pb-2">請對以下候選人表達意見（每位皆須圈選）：</h3>
            
            {CANDIDATES.map((cand, idx) => (
               <Card key={idx} className={`transition-all duration-200 ${choices[cand] ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-slate-200'}`}>
                 <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                        {idx + 1}
                      </div>
                      <span className="font-medium text-lg text-slate-800">{cand}</span>
                    </div>
                    
                    <div className="flex space-x-2 w-full sm:w-auto">
                       {OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            disabled={isExpired}
                            onClick={() => handleChoice(cand, opt.value)}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                               choices[cand] === opt.value
                                 ? opt.value === 'approve'
                                    ? 'bg-blue-900 text-white shadow-md cursor-default'
                                    : opt.value === 'disapprove'
                                      ? 'bg-red-600 text-white shadow-md cursor-default'
                                      : 'bg-slate-700 text-white shadow-md cursor-default'
                                 : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            } ${isExpired ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {opt.label}
                          </button>
                       ))}
                    </div>
                 </CardContent>
               </Card>
            ))}
         </div>

         {!isExpired && (
           <div className="pt-6 pb-12 flex justify-center sticky bottom-0 z-10 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
              <Button 
                onClick={submitVote} 
                disabled={saving || isExpired}
                className="w-full max-w-sm h-12 text-lg shadow-lg font-bold tracking-wide rounded-full"
              >
                {saving ? '儲存中...' : 
                 (voterData.status === 'voted' ? '更新我的選票' : '確認送出選票')}
              </Button>
           </div>
         )}
      </div>
    </div>
  )
}
