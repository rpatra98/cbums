import { useState, useEffect, useContext } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { useSession } from 'next-auth/react';
import { TransactionReason, UserRole, EmployeeSubrole } from '@/prisma/enums';
import { toast } from 'react-hot-toast';
import { SessionUpdateContext } from '@/app/dashboard/layout';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string;
}

interface TransferCoinsFormProps {
  onSuccess?: () => void;
  currentBalance: number;
}

const transferSchema = Yup.object().shape({
  toUserId: Yup.string().required('Recipient is required'),
  amount: Yup.number()
    .required('Amount is required')
    .positive('Amount must be positive')
    .integer('Amount must be a whole number'),
  notes: Yup.string(),
});

export default function TransferCoinsForm({ onSuccess, currentBalance }: TransferCoinsFormProps) {
  const { data: session } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch operators that can receive coins (only for admin users)
  useEffect(() => {
    let isMounted = true;
    
    const fetchUsers = async (retryCount = 0) => {
      if (retryCount > 3) {
        if (isMounted) setError('Failed to load users after multiple attempts');
        return;
      }
      
      try {
        if (session?.user?.role === UserRole.ADMIN) {
          // Admin users can only allocate coins to operators they created
          const response = await fetch('/api/users?role=EMPLOYEE&subrole=OPERATOR');
          
          if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.users && isMounted) {
            // Filter operators created by this admin
            const filteredUsers = data.users.filter(
              (user: User) => user.id !== session?.user?.id && 
                            user.role === 'EMPLOYEE' && 
                            user.subrole === 'OPERATOR'
            );
            setUsers(filteredUsers);
          }
        } else {
          // Other roles can't use this form
          setUsers([]);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching operators:', err);
          setError('Failed to load operators');
        }
      }
    };

    if (session?.user?.role === UserRole.ADMIN) {
      // Wait a moment after component mounts to avoid race conditions
      const timerId = setTimeout(() => fetchUsers(), 500);
      return () => {
        isMounted = false;
        clearTimeout(timerId);
      };
    } else {
      // If not admin, show empty list
      setUsers([]);
    }
    
    return () => {
      isMounted = false;
    };
  }, [session]);

  const handleSubmit = async (values: any, { resetForm, setSubmitting }: any) => {
    setLoading(true);
    setError('');

    try {
      // We're using the allocate endpoint instead of transfer endpoint
      const response = await fetch('/api/coins/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toUserId: values.toUserId,
          amount: Number(values.amount),
          reasonText: values.notes || 'Admin allocation to Operator',
        }),
      });

      // Check if response is valid before trying to parse it as JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Not JSON response, could be HTML error page
        throw new Error(`Server returned ${response.status} with non-JSON response. You may need to refresh the page.`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to allocate coins');
      }

      toast.success('Coins allocated successfully!');
      resetForm();
      
      // Update the session to reflect new coin balance
      await refreshUserSession();
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Error allocating coins:', err);
      setError(err.message || 'Failed to allocate coins');
      toast.error(err.message || 'Failed to allocate coins');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  // If not an admin, don't show the form
  if (session?.user?.role !== UserRole.ADMIN) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium mb-4">Allocate Coins</h3>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Only Admin users can allocate coins to Operators.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">Allocate Coins to Operators</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <Formik
        initialValues={{
          toUserId: '',
          amount: '',
          notes: '',
        }}
        validationSchema={transferSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting, values, errors, touched }) => (
          <Form className="space-y-4">
            <div>
              <label htmlFor="toUserId" className="block text-sm font-medium text-gray-700 mb-1">
                Operator
              </label>
              <Field
                as="select"
                id="toUserId"
                name="toUserId"
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                  errors.toUserId && touched.toUserId ? 'border-red-500' : ''
                }`}
              >
                <option value="">Select an operator</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </Field>
              <ErrorMessage name="toUserId" component="div" className="text-red-500 text-sm mt-1" />
            </div>
            
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount (max: {currentBalance})
              </label>
              <Field
                type="number"
                id="amount"
                name="amount"
                max={currentBalance}
                className={`mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md ${
                  errors.amount && touched.amount ? 'border-red-500' : ''
                }`}
              />
              <ErrorMessage name="amount" component="div" className="text-red-500 text-sm mt-1" />
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <Field
                as="textarea"
                id="notes"
                name="notes"
                rows={3}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              />
              <ErrorMessage name="notes" component="div" className="text-red-500 text-sm mt-1" />
            </div>
            
            <div>
              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Allocate Coins'}
              </button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
} 