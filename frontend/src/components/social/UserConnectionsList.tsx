import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { UserPublicProfile } from "../../lib/api/social";
import { useNavigate } from "react-router-dom";
import { Users, Star, Flame, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserConnectionsListProps {
  users: UserPublicProfile[];
  emptyMessage?: string;
  className?: string;
}

export function UserConnectionsList({ 
  users, 
  emptyMessage = "No se encontraron usuarios",
  className
}: UserConnectionsListProps) {
  const navigate = useNavigate();

  if (!users || users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 min-h-[200px] border-2 border-dashed border-black/5 dark:border-white/10 rounded-3xl bg-black/5 dark:bg-white/5">
        <Users className="w-12 h-12 mb-4 opacity-10" />
        <p className="text-sm font-black uppercase tracking-widest">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {users.map((u, index) => (
        <div 
          key={u.public_id} 
          className={cn(
            "flex items-center p-4 gap-4 cursor-pointer hover:bg-white/40 dark:hover:bg-white/10 transition-all duration-300 group relative border-b border-black/5 dark:border-white/5 last:border-0 rounded-2xl mx-1 my-0.5"
          )}
          onClick={() => navigate(`/u/${u.username}`)}
        >
          {/* Rank/Index would go here in a leaderboard, omitted for simple friends list */}
          
          <div className="flex-shrink-0 relative">
            <AvatarDisplay config={u.avatar_config} size={48} showCTA={false} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {u.name || `@${u.username}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
              @{u.username}
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-bold">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600">
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{u.current_streak}</span>
            </div>
            
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{u.points_earned}</span>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      ))}
    </div>
  );
}
