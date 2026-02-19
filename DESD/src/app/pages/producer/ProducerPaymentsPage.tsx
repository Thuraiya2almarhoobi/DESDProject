import { useNavigate } from 'react-router';
import { ArrowLeft, Download, Calendar } from 'lucide-react';
import { mockCommissionRecords } from '../../data/mockData';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function ProducerPaymentsPage() {
  const navigate = useNavigate();
  
  // Filter commission records for current producer (producer-1)
  const producerCommissions = mockCommissionRecords.filter(c => c.producerId === 'producer-1');

  const totalEarnings = producerCommissions.reduce((sum, c) => sum + (c.totalSales - c.commissionAmount), 0);
  const totalSales = producerCommissions.reduce((sum, c) => sum + c.totalSales, 0);
  const totalCommission = producerCommissions.reduce((sum, c) => sum + c.commissionAmount, 0);

  const handleExport = () => {
    // Simulate CSV export
    toast.success('Payment report exported as CSV');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/producer/dashboard')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold">Payment History</h1>
            <p className="text-gray-600">Weekly settlement reports</p>
          </div>
          <Button onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
              <p className="text-3xl font-semibold text-green-700">
                £{totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">After 5% commission</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Sales</p>
              <p className="text-3xl font-semibold">£{totalSales.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Gross revenue</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Platform Commission</p>
              <p className="text-3xl font-semibold text-gray-700">
                £{totalCommission.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">5% of sales</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Commission (5%)</TableHead>
                  <TableHead className="text-right">Your Earnings</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {producerCommissions.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="size-4 text-gray-400" />
                        <div>
                          <p className="font-medium">
                            {format(new Date(record.weekStart), 'MMM d')} -{' '}
                            {format(new Date(record.weekEnd), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{record.ordersCount}</TableCell>
                    <TableCell className="text-right">
                      £{record.totalSales.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-gray-600">
                      -£{record.commissionAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      £{(record.totalSales - record.commissionAmount).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Payment Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• Settlements are processed weekly on Mondays</p>
              <p>• A 5% platform commission is deducted from all sales</p>
              <p>• Payments are transferred to your registered bank account within 2-3 business days</p>
              <p>• Export your statements as CSV for accounting purposes</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}