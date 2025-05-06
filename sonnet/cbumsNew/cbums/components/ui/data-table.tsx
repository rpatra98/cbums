"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  columns: {
    accessorKey: string;
    header: string;
    cell?: ({ row }: { row: any }) => React.ReactNode;
  }[];
  data: any[];
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}

export function DataTable({ columns, data, pagination }: DataTableProps) {
  const [error, setError] = React.useState<Error | null>(null);

  const renderCell = (row: any, column: typeof columns[0]) => {
    try {
      // Helper function to get value from row
      const getValue = (key: string) => {
        try {
          // Handle nested properties like "user.name"
          if (key.includes(".")) {
            const parts = key.split(".");
            let value = row;
            for (const part of parts) {
              value = value?.[part];
              if (value === undefined) return null;
            }
            return value;
          }
          
          return row[key];
        } catch (err) {
          console.error(`Error getting value for key ${key}:`, err);
          return null;
        }
      };
      
      // Add getValue function to row object for cell renderers
      row.getValue = getValue;
      
      if (column.cell) {
        try {
          return column.cell({ row });
        } catch (err) {
          console.error(`Error rendering custom cell for ${column.accessorKey}:`, err);
          return <span className="text-red-500">Error</span>;
        }
      }
      
      return getValue(column.accessorKey);
    } catch (err) {
      console.error(`Error rendering cell:`, err);
      return <span className="text-red-500">Error</span>;
    }
  };
  
  // Validate data before rendering
  if (!data || !Array.isArray(data)) {
    return (
      <div className="text-center p-4 text-red-500">
        Invalid data format. Expected an array.
      </div>
    );
  }
  
  try {
    return (
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {columns.map((column, i) => (
                <th
                  key={column.accessorKey || i}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center p-4 text-muted-foreground">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={i}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  {columns.map((column, j) => (
                    <td
                      key={column.accessorKey || j}
                      className="p-4 align-middle"
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {pagination && (
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {data.length > 0 ? (
                <>
                  {pagination.pageSize * pagination.pageIndex + 1}-
                  {Math.min(
                    pagination.pageSize * (pagination.pageIndex + 1),
                    pagination.pageCount * pagination.pageSize
                  )}{" "}
                  of {pagination.pageCount * pagination.pageSize}
                </>
              ) : "0 items"}
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 py-2 px-4"
                onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
                disabled={pagination.pageIndex === 0}
              >
                Previous
              </button>
              <div className="text-sm font-medium">
                Page {pagination.pageIndex + 1} of {Math.max(1, pagination.pageCount)}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 py-2 px-4"
                onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
                disabled={pagination.pageIndex === pagination.pageCount - 1 || pagination.pageCount === 0}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  } catch (err: any) {
    console.error("Error rendering DataTable:", err);
    return (
      <div className="text-center p-4 text-red-500">
        An error occurred while rendering the table: {err.message}
      </div>
    );
  }
} 