import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { CoinTransactionData } from '@/lib/types';

interface TransactionHistoryProps {
  userId?: string;
  limit?: number;
  refreshTrigger?: number;
}

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function TransactionHistory({ userId, limit = 10, refreshTrigger = 0 }: TransactionHistoryProps) {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<CoinTransactionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: limit,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!session?.user) {
        console.log("No session, skipping fetch");
        return;
      }
      
      setLoading(true);
      setError('');
      
      try {
        const targetId = userId || session.user.id;
        const url = `/api/coins/history?userId=${targetId}&page=${pagination.page}&limit=${pagination.limit}`;
        
        console.log("Fetching transactions from:", url);
        const response = await fetch(url);
        
        // First check if the response is OK and has a JSON content type
        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.includes('application/json')) {
          console.error("API error or non-JSON response:", response.status, contentType);
          
          // Try to get the error message, but handle case where it's not JSON
          let errorMsg = `Error ${response.status}: Could not fetch transaction history`;
          try {
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
            }
          } catch (parseErr) {
            console.error("Error parsing error response:", parseErr);
          }
          
          throw new Error(errorMsg);
        }
        
        const data = await response.json();
        console.log("Transactions data received:", data);
        setTransactions(data.transactions || []);
        setPagination(data.pagination || pagination);
      } catch (err: any) {
        console.error('Error fetching transactions:', err);
        setError(err.message || 'Failed to load transaction history');
        // Show empty transaction list rather than error state for better UX
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [session, userId, pagination.page, pagination.limit, refreshTrigger]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: Date) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="py-4 text-center">
        <p>Loading transaction history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-gray-100 p-6 rounded-md text-center">
        <p>No transaction history found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                From
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                To
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction) => {
              const isReceived = transaction.toUser?.id === (userId || session?.user?.id);
              
              return (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(transaction.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {transaction.fromUser?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transaction.fromUser?.email || ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {transaction.toUser?.name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transaction.toUser?.email || ''}
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                    isReceived ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isReceived ? '+' : '-'}{transaction.amount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.reason 
                      ? transaction.reason.replace(/_/g, ' ') 
                      : transaction.reasonText 
                      ? transaction.reasonText 
                      : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.totalItems)}
                </span>{' '}
                of <span className="font-medium">{pagination.totalItems}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">First</span>
                  <span>First</span>
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <span>Previous</span>
                </button>
                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <span>Next</span>
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Last</span>
                  <span>Last</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 