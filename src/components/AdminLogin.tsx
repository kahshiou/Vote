import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from './ui';
import { sha256 } from '../lib/utils';
import { Lock } from 'lucide-react';

export function AdminLogin({ onLogin }: { onLogin: (hash: string) => void }) {
  const [email, setEmail] = useState('kahshiou@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("請輸入信箱與密碼");
      return;
    }
    
    // Using a hashed representation solves the "backendless" admin storage authentication
    const hash = await sha256(email + ":" + password);
    // Normally we would verify it exists first, but our App handles that by fetching the vault
    onLogin(hash);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-blue-900">
        <CardHeader className="text-center space-y-2">
           <div className="mx-auto bg-blue-100 w-12 h-12 flex items-center justify-center rounded-full mb-2">
             <Lock className="w-6 h-6 text-blue-900" />
           </div>
           <CardTitle className="text-2xl text-blue-900">管理員登入</CardTitle>
           <p className="text-sm text-slate-500">彰化縣立成功高級中學 - 續任投票系統</p>
        </CardHeader>
        <CardContent>
           <form onSubmit={handleSubmit} className="space-y-4 pt-2">
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">電子信箱</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
             </div>
             <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">專屬密碼</label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="輸入您的專屬密碼" />
             </div>
             {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
             <Button type="submit" className="w-full text-md h-10 mt-2">登入後台</Button>
           </form>
        </CardContent>
      </Card>
    </div>
  );
}
