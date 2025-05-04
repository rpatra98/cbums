// Import the manually defined enums
import { UserRole, EmployeeSubrole } from '@/prisma/enums';

// Re-export for easier usage throughout the app
export { UserRole, EmployeeSubrole };

// Additional type definitions
export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  subrole?: EmployeeSubrole | null;
  companyId?: string | null;
  coins: number;
}

export interface CoinTransactionData {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason?: string | null;
  reasonText?: string | null;
  createdAt: Date;
  fromUser?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  toUser?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
} 