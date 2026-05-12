import { USERS } from '../constants.js';
import { useUser } from '../UserContext.jsx';

const COLORS = {
  L: 'bg-amber-500 hover:bg-amber-600',
  C: 'bg-emerald-500 hover:bg-emerald-600',
  M: 'bg-sky-500 hover:bg-sky-600',
  J: 'bg-violet-500 hover:bg-violet-600',
};

export default function Welcome() {
  const { setCurrentUser } = useUser();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-6">
      <h1 className="text-4xl font-bold text-slate-800 mb-2">Production</h1>
      <p className="text-slate-500 mb-12">Choisissez votre profil</p>
      <div className="flex gap-8">
        {USERS.map((u) => (
          <button
            key={u}
            onClick={() => setCurrentUser(u)}
            className={`${COLORS[u]} w-36 h-36 rounded-full text-white text-6xl font-bold shadow-card transition transform hover:scale-105 active:scale-95`}
            aria-label={`Se connecter en tant que ${u}`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  );
}
