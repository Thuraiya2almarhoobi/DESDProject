import { useState } from 'react';
import { LogOut, Download, Calendar } from 'lucide-react';
import { mockCommissionRecords } from '../../data/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function AdminCommissionPage() {
  const { user, logout } = useAuth();
  const [dateFrom, setDateFrom] = useState('2026-02-09');
  const [dateTo, setDateTo] = useState('2026-02-15');

  const totalSales = mockCommissionRecords.reduce((sum, c) => sum + c.totalSales, 0);
  const totalCommission = mockCommissionRecords.reduce((sum, c) => sum + c.commissionAmount, 0);
  const totalOrders = mockCommissionRecords.reduce((sum, c) => sum + c.ordersCount, 0);

  const handleExport = () => {
    // Simulate CSV export
    const csvContent = [
      ['Producer', 'Week Start', 'Week End', 'Total Sales', 'Commission', 'Orders'],
      ...mockCommissionRecords.map(r => [
        r.producerName,
        r.weekStart,
        r.weekEnd,
        r.totalSales.toFixed(2),
        r.commissionAmount.toFixed(2),
        r.ordersCount,
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    toast.success('Commission report exported as CSV');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Commission Monitoring</p>
            </div>
            <Button variant="ghost" onClick={logout}>
              <LogOut className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Range Filter */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="date-from">From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="date-to">To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button onClick={handleExport}>
                <Download className="size-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Sales</p>
              <p className="text-3xl font-semibold">£{totalSales.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Commission</p>
              <p className="text-3xl font-semibold text-green-700">
                £{totalCommission.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Orders</p>
              <p className="text-3xl font-semibold">{totalOrders}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Commission Rate</p>
              <p className="text-3xl font-semibold">5%</p>
            </CardContent>
          </Card>
        </div>

        {/* Commission Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Commission Breakdown by Producer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producer</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Commission (5%)</TableHead>
                    <TableHead className="text-right">Producer Earnings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCommissionRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.producerName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-gray-400" />
                          <span className="text-sm">
                            {format(new Date(record.weekStart), 'MMM d')} -{' '}
                            {format(new Date(record.weekEnd), 'MMM d')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{record.ordersCount}</TableCell>
                      <TableCell className="text-right">
                        £{record.totalSales.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        £{record.commissionAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        £{(record.totalSales - record.commissionAmount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{totalOrders}</TableCell>
                    <TableCell className="text-right">£{totalSales.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-green-700">
                      £{totalCommission.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      £{(totalSales - totalCommission).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Additional Info */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Platform Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Platform commission is set at 5% of all sales</p>
              <p>• Commission is calculated and reported weekly</p>
              <p>• Producers receive 95% of their sales revenue</p>
              <p>• Export functionality allows downloading reports for accounting</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}