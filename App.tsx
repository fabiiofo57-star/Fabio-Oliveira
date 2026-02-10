
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction, FinancialGoal, UserProfile, ThemeConfig, TransactionType, AppState } from './types';
import { CATEGORIES, COLORS, ICONS } from './constants';
import { getFinancialInsights } from './services/geminiService';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

// --- Utilitários de Persistência (Simulação de Nuvem/Local) ---
// Usamos chaves dinâmicas baseadas no e-mail do usuário para que os dados não se misturem
const STORAGE_USERS = 'fb_finance_users_db'; // "Nuvem" de usuários registrados
const STORAGE_SESSION = 'fb_finance_active_session'; // Sessão local atual

const saveUserData = (email: string, data: any) => {
  localStorage.setItem(`fb_finance_data_${email}`, JSON.stringify(data));
};

const getUserData = (email: string) => {
  const data = localStorage.getItem(`fb_finance_data_${email}`);
  return data ? JSON.parse(data) : null;
};

// --- Shared UI Components ---

const Card: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  noPadding?: boolean;
  style?: React.CSSProperties;
}> = ({ children, className = "", noPadding = false, style }) => (
  <div 
    className={`bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 transition-all ${noPadding ? '' : 'p-6'} ${className}`}
    style={style}
  >
    {children}
  </div>
);

const ProgressBar: React.FC<{ progress: number; color: string }> = ({ progress, color }) => {
  const safeProgress = isNaN(progress) || !isFinite(progress) ? 0 : Math.max(0, Math.min(100, progress));
  return (
    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
      <div 
        className="h-2 rounded-full transition-all duration-700 ease-out" 
        style={{ width: `${safeProgress}%`, backgroundColor: color }}
      />
    </div>
  );
};

// --- Auth Component ---

const AuthScreen: React.FC<{ 
  onAuthSuccess: (profile: UserProfile) => void; 
  primaryColor: string 
}> = ({ onAuthSuccess, primaryColor }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const email = formData.email.trim().toLowerCase();
    if (!email || !formData.password || (!isLogin && !formData.name)) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const users = JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
      
      if (isLogin) {
        const user = users.find((u: any) => u.email === email && u.password === formData.password);
        if (user) {
          const profile = {
            name: user.name,
            email: user.email,
            profilePic: user.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`,
            monthlyIncome: Number(user.monthlyIncome) || 0,
            currency: 'R$'
          };
          localStorage.setItem(STORAGE_SESSION, JSON.stringify(profile));
          onAuthSuccess(profile);
        } else {
          setError('E-mail ou senha incorretos.');
        }
      } else {
        if (users.some((u: any) => u.email === email)) {
          setError('Este e-mail já está cadastrado.');
          return;
        }
        const newUser = { 
          ...formData, 
          email: email,
          profilePic: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`, 
          monthlyIncome: 0 
        };
        users.push(newUser);
        localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
        setIsLogin(true);
        setError('Cadastro realizado! Agora você já pode entrar.');
      }
    } catch (e) {
      setError('Erro no processamento. Verifique o armazenamento do navegador.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="max-w-md w-full p-10 animate-scaleUp">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 text-white shadow-xl" style={{ backgroundColor: primaryColor }}>
            <ICONS.Wallet className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">FB finance</h1>
          <p className="text-gray-400 text-center mt-3 text-sm">Dados salvos com segurança em tempo real</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-black text-gray-500 uppercase ml-2">Nome</label>
              <input 
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20" 
                placeholder="Como quer ser chamado?"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-500 uppercase ml-2">E-mail</label>
            <input 
              type="email"
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20" 
              placeholder="seu@email.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-500 uppercase ml-2">Senha</label>
            <input 
              type="password"
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20" 
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {error && <p className={`text-sm font-bold text-center ${error.includes('Cadastro') ? 'text-emerald-500' : 'text-rose-500'}`}>{error}</p>}

          <button 
            type="submit"
            className="w-full py-5 text-white font-black rounded-2xl shadow-lg transition-all hover:brightness-110 active:scale-95" 
            style={{ backgroundColor: primaryColor }}
          >
            {isLogin ? 'ENTRAR' : 'CADASTRAR'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm font-bold text-gray-400 hover:text-indigo-500 transition-colors"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já possui conta? Faça login'}
          </button>
        </div>
      </Card>
    </div>
  );
};

// --- View Components ---

const DashboardView: React.FC<{
  profile: UserProfile;
  totals: { income: number; expenses: number; balance: number };
  chartData: any[];
  aiInsights: string;
  isAiLoading: boolean;
  onRefreshInsights: () => void;
  goals: FinancialGoal[];
  onNavigate: (tab: any) => void;
  theme: ThemeConfig;
}> = ({ profile, totals, chartData, aiInsights, isAiLoading, onRefreshInsights, goals, onNavigate, theme }) => (
  <div className="space-y-8 animate-fadeIn">
    {/* Banner de Sincronização */}
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-full w-fit">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      Dados Sincronizados com a Nuvem
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="group border-none bg-gradient-to-br from-indigo-600 to-indigo-700 text-white overflow-hidden relative">
         <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
           <ICONS.Wallet className="w-32 h-32" />
         </div>
         <p className="text-indigo-100 text-sm font-bold uppercase tracking-wider mb-2">Saldo Disponível</p>
         <h3 className="text-4xl font-black">{profile.currency} {totals.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
      </Card>
      <Card className="border-l-4" style={{ borderLeftColor: '#10b981' }}>
         <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Entradas Totais</p>
         <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{profile.currency} {totals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
      </Card>
      <Card className="border-l-4" style={{ borderLeftColor: '#f43f5e' }}>
         <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">Saídas Totais</p>
         <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400">{profile.currency} {totals.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
      </Card>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="flex flex-col">
        <h4 className="text-xl font-black mb-8 flex items-center gap-2">
          <ICONS.History className="w-6 h-6 text-indigo-500" /> Histórico Semanal
        </h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} style={{ fontSize: '12px', fontWeight: 'bold' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', background: theme.isDarkMode ? '#1f2937' : '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`]}
              />
              <Area type="monotone" dataKey="inc" stroke="#10b981" fill="#10b98120" strokeWidth={3} name="Entradas" />
              <Area type="monotone" dataKey="exp" stroke="#f43f5e" fill="#f43f5e20" strokeWidth={3} name="Saídas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="bg-gray-900 text-white border-none shadow-2xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/20 rounded-2xl">
                <ICONS.Bot className="w-8 h-8 text-indigo-400" />
              </div>
              <h4 className="text-xl font-black">Assistente IA</h4>
            </div>
            {isAiLoading && <div className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full" />}
          </div>
          <div className="bg-white/5 rounded-3xl p-6 min-h-[140px]">
            {isAiLoading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-3 bg-white/10 rounded w-3/4"></div>
                <div className="h-3 bg-white/10 rounded w-full"></div>
                <div className="h-3 bg-white/10 rounded w-2/3"></div>
              </div>
            ) : (
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{aiInsights || "Sua IA está pronta. Peça dicas baseadas nos seus gastos registrados."}</div>
            )}
          </div>
        </div>
        <button 
          onClick={onRefreshInsights} 
          disabled={isAiLoading} 
          className="mt-6 w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
           {isAiLoading ? 'ANALISANDO DADOS...' : 'PEDIR CONSELHO FINANCEIRO'}
        </button>
      </Card>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-xl font-black">Metas em Foco</h4>
          <button onClick={() => onNavigate('goals')} className="text-sm font-bold text-indigo-500 hover:underline">Ver todas</button>
        </div>
        <div className="space-y-5">
          {goals.length > 0 ? goals.slice(0, 3).map(goal => {
            const prog = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            return (
              <div key={goal.id} className="space-y-2">
                <div className="flex justify-between text-sm font-bold">
                  <span>{goal.name}</span>
                  <span>{Math.round(prog)}%</span>
                </div>
                <ProgressBar progress={prog} color={goal.color} />
              </div>
            );
          }) : (
            <p className="text-center text-gray-400 py-4 italic">Nenhuma meta definida ainda.</p>
          )}
        </div>
      </Card>
      
      <Card className="flex flex-col justify-center items-center text-center space-y-4 border-2 border-dashed border-gray-200 dark:border-gray-800 bg-transparent">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full text-gray-400">
          <ICONS.Plus className="w-10 h-10" />
        </div>
        <div>
          <h4 className="text-lg font-black">Novo Lançamento</h4>
          <p className="text-sm text-gray-500">Mantenha seus registros sempre em dia.</p>
        </div>
        <button onClick={() => onNavigate('transactions')} className="px-8 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-sm hover:scale-105 transition-all">
          ADICIONAR AGORA
        </button>
      </Card>
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'goals' | 'profile' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    name: 'Usuário', email: '', profilePic: '', monthlyIncome: 0, currency: 'R$'
  });
  const [theme, setTheme] = useState<ThemeConfig>({ primaryColor: '#6366f1', isDarkMode: false });
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Carregar sessão ativa no início
  useEffect(() => {
    const session = localStorage.getItem(STORAGE_SESSION);
    if (session) {
      const parsedProfile = JSON.parse(session);
      setProfile(parsedProfile);
      
      // Carregar dados específicos do usuário (NUVEM SIMULADA)
      const userData = getUserData(parsedProfile.email);
      if (userData) {
        setTransactions(userData.transactions || []);
        setGoals(userData.goals || []);
        setTheme(userData.theme || { primaryColor: '#6366f1', isDarkMode: false });
      }
      setIsAuthenticated(true);
    }
    setIsInitialLoading(false);
  }, []);

  // Salvar dados em tempo real (LOCAL + NUVEM SIMULADA)
  useEffect(() => {
    if (isAuthenticated && profile.email) {
      saveUserData(profile.email, { transactions, goals, theme });
      theme.isDarkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
    }
  }, [transactions, goals, theme, isAuthenticated, profile.email]);

  const totals = useMemo(() => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + Number(t.amount), 0) + (Number(profile.monthlyIncome) || 0);
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + Number(t.amount), 0);
    
    return { 
      income, 
      expenses, 
      balance: income - expenses 
    };
  }, [transactions, profile.monthlyIncome]);

  const chartData = useMemo(() => {
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    return days.map(date => {
      const dayTransactions = transactions.filter(t => t.date === date);
      return { 
        label: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short' }),
        inc: dayTransactions.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0),
        exp: dayTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0)
      };
    });
  }, [transactions]);

  const fetchInsights = async () => {
    if (!isAuthenticated) return;
    setIsAiLoading(true);
    try {
      const insight = await getFinancialInsights({ transactions, goals, profile, theme });
      setAiInsights(insight);
    } catch (e) {
      setAiInsights("Erro ao conectar com a inteligência artificial.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Deseja realmente sair da sua conta?')) {
      localStorage.removeItem(STORAGE_SESSION);
      setIsAuthenticated(false);
      setTransactions([]);
      setGoals([]);
      setProfile({ name: '', email: '', profilePic: '', monthlyIncome: 0, currency: 'R$' });
    }
  };

  if (isInitialLoading) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse">FB FINANCE CARREGANDO...</div>;
  if (!isAuthenticated) return <AuthScreen onAuthSuccess={(p) => { setProfile(p); setIsAuthenticated(true); }} primaryColor={theme.primaryColor} />;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row dark:bg-gray-950 transition-colors">
      {/* Sidebar Desktop */}
      <aside className="w-80 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 hidden lg:flex flex-col p-8">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-lg" style={{ backgroundColor: theme.primaryColor }}>
            <ICONS.Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black">FB finance</h1>
        </div>
        <nav className="space-y-3 flex-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<ICONS.Wallet />} label="Painel Geral" color={theme.primaryColor} />
          <NavItem active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<ICONS.TrendDown />} label="Minhas Finanças" color={theme.primaryColor} />
          <NavItem active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={<ICONS.Target />} label="Objetivos" color={theme.primaryColor} />
          <NavItem active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<ICONS.User />} label="Meu Perfil" color={theme.primaryColor} />
          <NavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<ICONS.Settings />} label="Configurações" color={theme.primaryColor} />
        </nav>
        <div className="mt-auto pt-8 border-t border-gray-100 dark:border-gray-800">
           <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800">
              <img src={profile.profilePic} className="w-10 h-10 rounded-xl" alt="Eu" />
              <div className="truncate">
                <p className="text-xs font-black truncate">{profile.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{profile.email}</p>
              </div>
           </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-12 lg:p-20 overflow-y-auto">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-5">
            {activeTab === 'dashboard' && (
              <img 
                src={profile.profilePic} 
                className="w-16 h-16 rounded-[22px] object-cover shadow-xl border-2 border-white dark:border-gray-800 animate-fadeIn" 
                alt="Avatar" 
              />
            )}
            <h2 className="text-4xl font-black text-gray-900 dark:text-white">
              {activeTab === 'dashboard' ? `Olá, ${profile.name.split(' ')[0]} 👋` : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h2>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardView 
            profile={profile} totals={totals} chartData={chartData} 
            aiInsights={aiInsights} isAiLoading={isAiLoading} 
            onRefreshInsights={fetchInsights} goals={goals} 
            onNavigate={setActiveTab} theme={theme}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView 
            transactions={transactions} currency={profile.currency} primaryColor={theme.primaryColor} 
            onAdd={t => setTransactions([{...t, id: crypto.randomUUID()}, ...transactions])}
            onDelete={id => setTransactions(transactions.filter(t => t.id !== id))}
          />
        )}

        {activeTab === 'goals' && (
          <GoalsView 
             goals={goals} currency={profile.currency} primaryColor={theme.primaryColor}
             onAdd={g => setGoals([{...g, id: crypto.randomUUID()}, ...goals])}
             onDelete={id => setGoals(goals.filter(g => g.id !== id))}
             onUpdateAmount={(id, amount) => setGoals(goals.map(g => g.id === id ? {...g, currentAmount: Number(g.currentAmount) + Number(amount)} : g))}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView 
            profile={profile} 
            onUpdate={(newP) => {
              setProfile(newP);
              localStorage.setItem(STORAGE_SESSION, JSON.stringify(newP));
              // Atualizar no DB de usuários também
              const users = JSON.parse(localStorage.getItem(STORAGE_USERS) || '[]');
              const updatedUsers = users.map((u: any) => u.email === newP.email ? { ...u, ...newP } : u);
              localStorage.setItem(STORAGE_USERS, JSON.stringify(updatedUsers));
            }} 
            primaryColor={theme.primaryColor} 
          />
        )}

        {activeTab === 'settings' && (
          <Card className="max-w-xl mx-auto space-y-8 animate-fadeIn">
            <h3 className="text-2xl font-black">Aparência e Sistema</h3>
            <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl">
              <div>
                <p className="font-bold">Modo Escuro</p>
                <p className="text-xs text-gray-400">Alterne entre temas claro e escuro</p>
              </div>
              <button 
                onClick={() => setTheme({...theme, isDarkMode: !theme.isDarkMode})} 
                className={`w-14 h-8 rounded-full relative transition-all ${theme.isDarkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${theme.isDarkMode ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="font-bold text-sm ml-2">Cor de Destaque</p>
              <div className="flex flex-wrap gap-4 px-2">
                {COLORS.map(c => (
                  <button 
                    key={c.value} 
                    onClick={() => setTheme({...theme, primaryColor: c.value})} 
                    className={`w-12 h-12 rounded-2xl transition-all ${theme.primaryColor === c.value ? 'ring-4 ring-offset-4 scale-110' : 'hover:scale-105 opacity-60'}`} 
                    style={{ backgroundColor: c.value, '--tw-ring-color': c.value } as any} 
                  />
                ))}
              </div>
            </div>
            <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
               <button 
                onClick={handleLogout} 
                className="w-full py-5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-500 font-black hover:bg-rose-100 transition-all active:scale-95"
               >
                 FINALIZAR SESSÃO E SAIR
               </button>
            </div>
          </Card>
        )}
      </main>

      {/* Navegação Mobile */}
      <div className="lg:hidden fixed bottom-6 left-6 right-6 h-18 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl z-40 flex items-center justify-around px-4">
          <MobileNavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<ICONS.Wallet />} color={theme.primaryColor} />
          <MobileNavItem active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} icon={<ICONS.TrendDown />} color={theme.primaryColor} />
          <MobileNavItem active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} icon={<ICONS.Target />} color={theme.primaryColor} />
          <MobileNavItem active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<ICONS.User />} color={theme.primaryColor} />
          <MobileNavItem active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<ICONS.Settings />} color={theme.primaryColor} />
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleUp { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        .animate-scaleUp { animation: scaleUp 0.3s ease-out forwards; }
        .h-18 { height: 4.5rem; }
      `}</style>
    </div>
  );
}

const NavItem: React.FC<{ active: boolean; label: string; icon: React.ReactNode; onClick: () => void; color: string }> = ({ active, label, icon, onClick, color }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-black transition-all ${active ? 'text-white shadow-xl translate-x-1' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`} 
    style={active ? { backgroundColor: color } : {}}
  >
    <div className={active ? 'scale-110' : 'opacity-60'}>{icon}</div>
    <span className="text-sm">{label}</span>
  </button>
);

const MobileNavItem: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; color: string }> = ({ active, onClick, icon, color }) => (
  <button 
    onClick={onClick} 
    className={`p-3 rounded-2xl transition-all active:scale-90 ${active ? 'text-white' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`} 
    style={active ? { backgroundColor: color, boxShadow: `0 8px 15px -3px ${color}50` } : {}}
  >
    {icon}
  </button>
);

// --- Novas Visualizações (Transactions e Goals) Refatoradas para maior Robustez ---

const TransactionsView: React.FC<{
  transactions: Transaction[];
  currency: string;
  primaryColor: string;
  onAdd: (t: Omit<Transaction, 'id'>) => void;
  onDelete: (id: string) => void;
}> = ({ transactions, currency, primaryColor, onAdd, onDelete }) => {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const [newT, setNewT] = useState<Omit<Transaction, 'id'>>({
    description: '', amount: 0, type: 'expense', category: CATEGORIES.expense[0], date: new Date().toISOString().split('T')[0]
  });

  const filtered = transactions.filter(t => t.description.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-black">Histórico Financeiro</h2>
        <div className="flex gap-4">
          <input 
            placeholder="O que está procurando?" 
            className="px-6 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 outline-none w-full md:w-80 shadow-sm focus:ring-2 ring-indigo-500/20" 
            value={filter} onChange={e => setFilter(e.target.value)} 
          />
          <button 
            onClick={() => setShowModal(true)} 
            className="px-6 py-3 rounded-2xl text-white font-black shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center gap-2" 
            style={{ backgroundColor: primaryColor }}
          >
            <ICONS.Plus className="w-5 h-5" /> ADICIONAR
          </button>
        </div>
      </div>
      <Card noPadding className="overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-8 py-6">Transação</th>
                <th className="px-8 py-6">Tipo / Categoria</th>
                <th className="px-8 py-6">Data</th>
                <th className="px-8 py-6 text-right">Valor</th>
                <th className="px-8 py-6 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-bold text-gray-900 dark:text-white">{t.description}</p>
                    <p className="text-[10px] text-gray-500 font-medium uppercase">{t.category}</p>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                      {t.type === 'income' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-xs text-gray-500 font-bold">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                  <td className={`px-8 py-6 text-right font-black text-lg ${t.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {t.type === 'income' ? '+' : '-'} {currency} {Number(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <button onClick={() => onDelete(t.id)} className="text-gray-300 hover:text-rose-500 p-2 rounded-xl hover:bg-rose-50 transition-all">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (<tr><td colSpan={5} className="px-8 py-20 text-center text-gray-400 font-bold italic">Nada por aqui. Adicione seu primeiro registro!</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fadeIn">
          <Card className="max-w-md w-full animate-scaleUp shadow-2xl">
            <h3 className="text-2xl font-black mb-8">Novo Lançamento</h3>
            <div className="space-y-5">
              <div className="flex p-1.5 bg-gray-100 dark:bg-gray-800 rounded-2xl">
                <button onClick={() => setNewT({...newT, type: 'expense', category: CATEGORIES.expense[0]})} className={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all ${newT.type === 'expense' ? 'bg-white dark:bg-gray-700 text-rose-500 shadow-lg scale-[1.02]' : 'text-gray-400'}`}>SAÍDA / GASTO</button>
                <button onClick={() => setNewT({...newT, type: 'income', category: CATEGORIES.income[0]})} className={`flex-1 py-3.5 rounded-xl text-xs font-black transition-all ${newT.type === 'income' ? 'bg-white dark:bg-gray-700 text-emerald-500 shadow-lg scale-[1.02]' : 'text-gray-400'}`}>ENTRADA / GANHO</button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Título do Registro</label>
                <input placeholder="Ex: Ifood, Netflix, Salário..." className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20" value={newT.description} onChange={e => setNewT({...newT, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Valor</label>
                  <input type="number" placeholder="0,00" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20 font-black text-lg" value={newT.amount || ''} onChange={e => setNewT({...newT, amount: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Data</label>
                  <input type="date" className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20" value={newT.date} onChange={e => setNewT({...newT, date: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-2">Categoria</label>
                <select className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/20 font-bold" value={newT.category} onChange={e => setNewT({...newT, category: e.target.value})}>
                  {(newT.type === 'income' ? CATEGORIES.income : CATEGORIES.expense).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-4 pt-8">
                <button onClick={() => setShowModal(false)} className="flex-1 py-4 font-black text-gray-400 text-sm hover:text-gray-600">CANCELAR</button>
                <button 
                  onClick={() => { if(newT.amount > 0 && newT.description) { onAdd(newT); setShowModal(false); } }} 
                  className="flex-1 py-4 rounded-2xl text-white font-black shadow-xl text-sm active:scale-95 transition-all" 
                  style={{ backgroundColor: primaryColor }}
                >
                  REGISTRAR AGORA
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const GoalsView: React.FC<{
  goals: FinancialGoal[];
  currency: string;
  primaryColor: string;
  onAdd: (g: Omit<FinancialGoal, 'id'>) => void;
  onDelete: (id: string) => void;
  onUpdateAmount: (id: string, amount: number) => void;
}> = ({ goals, currency, primaryColor, onAdd, onDelete, onUpdateAmount }) => {
  const [showModal, setShowModal] = useState(false);
  const [newG, setNewG] = useState<Omit<FinancialGoal, 'id'>>({
    name: '', targetAmount: 0, currentAmount: 0, deadline: new Date().toISOString().split('T')[0], color: COLORS[0].value
  });
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black">Planos e Objetivos</h2>
        <button onClick={() => setShowModal(true)} className="px-6 py-3 rounded-2xl text-white font-black shadow-lg flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all" style={{ backgroundColor: primaryColor }}>
          <ICONS.Plus className="w-5 h-5" /> NOVA META
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {goals.map(goal => {
          const prog = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
          return (
            <Card key={goal.id} className="relative group overflow-hidden shadow-lg border-none">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onDelete(goal.id)} className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-500 rounded-xl hover:bg-rose-100 transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
              <div className="flex items-center gap-5 mb-8">
                <div className="p-5 rounded-3xl bg-gray-50 dark:bg-gray-800 shadow-inner" style={{ color: goal.color }}><ICONS.Target className="w-10 h-10" /></div>
                <div>
                  <h3 className="text-xl font-black leading-tight">{goal.name}</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="space-y-3 mb-10">
                <div className="flex justify-between items-end">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Acumulado</span>
                     <span className="text-3xl font-black" style={{ color: goal.color }}>{currency} {Number(goal.currentAmount).toLocaleString('pt-BR')}</span>
                   </div>
                   <span className="text-sm font-bold text-gray-300 dark:text-gray-700 mb-1">de {Number(goal.targetAmount).toLocaleString('pt-BR')}</span>
                </div>
                <ProgressBar progress={prog} color={goal.color} />
                <p className="text-right text-[10px] font-black text-gray-400 uppercase tracking-tighter">{Math.round(prog)}% concluído</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => onUpdateAmount(goal.id, 100)} className="flex-1 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-xs font-black hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95">+ 100</button>
                <button onClick={() => onUpdateAmount(goal.id, 500)} className="flex-1 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 text-xs font-black hover:bg-gray-100 dark:hover:bg-gray-700 transition-all active:scale-95">+ 500</button>
              </div>
            </Card>
          );
        })}
        {goals.length === 0 && (<div className="col-span-full py-32 text-center text-gray-300 dark:text-gray-800 font-black text-2xl uppercase tracking-tighter">Crie planos para seu futuro.</div>)}
      </div>
    </div>
  );
};

const ProfileView: React.FC<{
  profile: UserProfile;
  onUpdate: (p: UserProfile) => void;
  primaryColor: string;
}> = ({ profile, onUpdate, primaryColor }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handlePhotoClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onUpdate({ ...profile, profilePic: reader.result as string });
      reader.readAsDataURL(file);
    }
  };
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      <h2 className="text-3xl font-black">Meu Perfil</h2>
      <Card className="p-12 text-center shadow-2xl">
        <div className="relative inline-block mb-12 group cursor-pointer" onClick={handlePhotoClick}>
          <div className="relative w-44 h-44 overflow-hidden rounded-[50px] shadow-2xl mx-auto border-8 border-white dark:border-gray-800 group-hover:scale-105 transition-all">
            <img src={profile.profilePic} className="w-full h-full object-cover" alt="Profile" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
          </div>
          <p className="mt-5 text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Trocar foto de perfil</p>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        </div>
        <div className="space-y-8 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Seu Nome</label>
              <input className="w-full px-6 py-5 rounded-3xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 ring-indigo-500/10 font-bold" value={profile.name} onChange={e => onUpdate({...profile, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">E-mail Cadastrado</label>
              <input disabled className="w-full px-6 py-5 rounded-3xl bg-gray-100 dark:bg-gray-800/50 border-none outline-none text-gray-400 font-bold cursor-not-allowed" value={profile.email} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase ml-2 tracking-widest">Renda Mensal Fixa (R$)</label>
            <input type="number" className="w-full px-6 py-5 rounded-3xl bg-gray-50 dark:bg-gray-800 border-none outline-none focus:ring-2 font-black text-xl ring-indigo-500/10" value={profile.monthlyIncome || ''} onChange={e => onUpdate({...profile, monthlyIncome: Number(e.target.value)})} />
            <p className="text-[9px] text-gray-400 italic ml-2 mt-1">* Este valor é somado ao saldo disponível automaticamente todo mês.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
