import { useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  ArrowLeft, 
  Edit, 
  Plus, 
  AlertCircle, 
  Calendar, 
  TrendingDown, 
  Tag, 
  Eye,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { mockProducts } from '../../data/mockData';
import { Product, AvailabilityType } from '../../types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../components/ui/alert-dialog';
import { Separator } from '../../components/ui/separator';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../../components/ProductBadges';
import { toast } from 'sonner';

export function ProducerInventoryPage() {
  const navigate = useNavigate();
  
  // Filter products for current producer (producer-1 in mock data)
  const producerProducts = mockProducts.filter(p => p.producerId === 'producer-1');
  const [products, setProducts] = useState(producerProducts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterHealthStatus, setFilterHealthStatus] = useState<'all' | 'low-stock' | 'out-of-stock' | 'season-ending'>('all');

  // 5) Product health calculations
  const lowStockItems = products.filter(p => p.stock > 0 && p.stock < 10);
  const outOfStockItems = products.filter(p => p.stock === 0);
  const seasonEndingItems = products.filter(p => p.seasonalDates && p.availability === 'in-season'); // Mock: assume ending soon

  // Filter products based on health status
  const filteredProducts = (() => {
    switch (filterHealthStatus) {
      case 'low-stock':
        return lowStockItems;
      case 'out-of-stock':
        return outOfStockItems;
      case 'season-ending':
        return seasonEndingItems;
      default:
        return products;
    }
  })();

  // 4) One-click stock toggle
  const toggleInStock = (productId: string) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const newStock = p.stock === 0 ? 10 : 0; // Toggle between 0 and 10
          const newAvailability: AvailabilityType = newStock === 0 ? 'unavailable' : (p.seasonalDates ? 'in-season' : 'year-round');
          toast.success(newStock === 0 ? 'Product marked out of stock' : 'Product marked in stock');
          return { ...p, stock: newStock, availability: newAvailability };
        }
        return p;
      })
    );
  };

  const updateStock = (productId: string, stock: number) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const newAvailability: AvailabilityType = stock === 0 ? 'unavailable' : (p.seasonalDates ? 'in-season' : 'year-round');
          return { ...p, stock, availability: newAvailability };
        }
        return p;
      })
    );
  };

  const updateAvailability = (productId: string, availability: AvailabilityType) => {
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, availability } : p))
    );
    toast.success('Availability updated');
  };

  const updateSeasonalDates = (productId: string, seasonalDates: string) => {
    setProducts(prev =>
      prev.map(p => (p.id === productId ? { ...p, seasonalDates } : p))
    );
    toast.success('Seasonal dates updated');
  };

  const markAllOutOfStock = () => {
    setProducts(prev =>
      prev.map(p => ({ ...p, stock: 0, availability: 'unavailable' as AvailabilityType }))
    );
    toast.success('All products marked out of stock');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/producer/dashboard')}
              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to Dashboard
            </Button>
            
            {/* 8) Preview as customer button */}
            <Button 
              variant="outline"
              onClick={() => navigate('/marketplace')}
              className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <Eye className="size-4" />
              Preview as customer
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Inventory Management</h1>
            <p className="text-gray-700 mt-1">Manage your products, stock levels, and seasonal availability</p>
          </div>
          <div className="flex gap-2">
            {/* 7) Create surplus deal button */}
            <Button 
              variant="outline"
              className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <Tag className="size-4" />
              Create surplus deal
            </Button>
            <Button className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
              <Plus className="size-4" />
              Add New Product
            </Button>
          </div>
        </div>

        {/* 5) Product Health Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-md ${
              filterHealthStatus === 'all' ? 'ring-2 ring-green-600' : ''
            }`}
            onClick={() => setFilterHealthStatus('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">All products</p>
                  <p className="text-2xl font-semibold text-gray-900">{products.length}</p>
                </div>
                <CheckCircle2 className="size-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-orange-200 bg-orange-50/30 ${
              filterHealthStatus === 'low-stock' ? 'ring-2 ring-orange-600' : ''
            }`}
            onClick={() => setFilterHealthStatus('low-stock')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Low stock</p>
                  <p className="text-2xl font-semibold text-orange-700">{lowStockItems.length}</p>
                </div>
                <AlertCircle className="size-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-red-200 bg-red-50/30 ${
              filterHealthStatus === 'out-of-stock' ? 'ring-2 ring-red-600' : ''
            }`}
            onClick={() => setFilterHealthStatus('out-of-stock')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Out of stock</p>
                  <p className="text-2xl font-semibold text-red-700">{outOfStockItems.length}</p>
                </div>
                <XCircle className="size-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md border-blue-200 bg-blue-50/30 ${
              filterHealthStatus === 'season-ending' ? 'ring-2 ring-blue-600' : ''
            }`}
            onClick={() => setFilterHealthStatus('season-ending')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Season ending</p>
                  <p className="text-2xl font-semibold text-blue-700">{seasonEndingItems.length}</p>
                </div>
                <Calendar className="size-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 4) Bulk Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Showing {filteredProducts.length} of {products.length} products
            </Badge>
            {filterHealthStatus !== 'all' && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilterHealthStatus('all')}
                className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                Clear filter
              </Button>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 text-red-600 border-red-300 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                <AlertTriangle className="size-4" />
                Mark all out of stock
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark all products out of stock?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will set stock to 0 for all products and hide them from customer searches. You can re-enable them individually later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={markAllOutOfStock} className="bg-red-600 hover:bg-red-700">
                  Mark all out of stock
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Product List */}
        <div className="grid gap-6">
          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No products found for this filter</p>
                <Button 
                  variant="outline" 
                  onClick={() => setFilterHealthStatus('all')}
                  className="mt-4"
                >
                  View all products
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredProducts.map(product => (
              <Card key={product.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="size-20 rounded object-cover flex-shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <CardTitle className="text-lg mb-2">{product.name}</CardTitle>
                          <div className="flex gap-2 flex-wrap">
                            <AvailabilityBadge availability={product.availability} />
                            {product.isOrganic && <OrganicBadge />}
                            {product.isSurplus && <SurplusBadge />}
                            {product.stock === 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="size-3" />
                                Out of stock
                              </Badge>
                            )}
                            {product.stock > 0 && product.stock < 10 && (
                              <Badge variant="outline" className="gap-1 border-orange-300 bg-orange-50 text-orange-700">
                                <AlertCircle className="size-3" />
                                Low stock
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {/* 4) One-click stock toggle */}
                          <Button
                            variant={product.stock === 0 ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleInStock(product.id)}
                            className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                          >
                            {product.stock === 0 ? (
                              <>
                                <CheckCircle2 className="size-4" />
                                Mark in stock
                              </>
                            ) : (
                              <>
                                <XCircle className="size-4" />
                                Mark out of stock
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(editingId === product.id ? null : product.id)}
                            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                          >
                            <Edit className="size-4 mr-2" />
                            {editingId === product.id ? 'Done' : 'Edit'}
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{product.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Price</p>
                      <p className="font-semibold">
                        £{product.price.toFixed(2)}/{product.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Category</p>
                      <p className="font-medium">{product.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Stock</p>
                      <p className="font-medium">
                        {product.stock} {product.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Seasonal Dates</p>
                      <p className="font-medium">{product.seasonalDates || 'Year-round'}</p>
                    </div>
                  </div>

                  {editingId === product.id && (
                    <div className="pt-4 border-t space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* 4) Stock input with unit lock */}
                        <div className="space-y-2">
                          <Label htmlFor={`stock-${product.id}`} className="flex items-center gap-2">
                            Update Stock Level
                            <HelpCircle className="size-3 text-gray-400" />
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`stock-${product.id}`}
                              type="number"
                              min="0"
                              value={product.stock}
                              onChange={(e) => updateStock(product.id, parseInt(e.target.value) || 0)}
                              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            />
                            <div className="flex items-center px-3 border rounded-md bg-gray-50 text-sm text-gray-700 font-medium min-w-[4rem] justify-center">
                              {product.unit}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 flex items-start gap-1">
                            <AlertCircle className="size-3 mt-0.5 flex-shrink-0" />
                            When stock hits 0, product is hidden from customers
                          </p>
                        </div>

                        {/* 4) Seasonal availability controls */}
                        <div className="space-y-2">
                          <Label htmlFor={`avail-${product.id}`} className="flex items-center gap-2">
                            Availability
                            <HelpCircle className="size-3 text-gray-400" />
                          </Label>
                          <Select
                            value={product.availability}
                            onValueChange={(value) => updateAvailability(product.id, value as AvailabilityType)}
                          >
                            <SelectTrigger 
                              id={`avail-${product.id}`}
                              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="in-season">In season</SelectItem>
                              <SelectItem value="year-round">Year-round</SelectItem>
                              <SelectItem value="unavailable">Unavailable</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500 flex items-start gap-1">
                            <Calendar className="size-3 mt-0.5 flex-shrink-0" />
                            Seasonal dates control customer "In Season" badge
                          </p>
                        </div>
                      </div>

                      {/* 4) Seasonal month range (if in-season) */}
                      {product.availability === 'in-season' && (
                        <div className="space-y-2">
                          <Label htmlFor={`season-${product.id}`} className="flex items-center gap-2">
                            Seasonal Date Range
                            <Badge variant="secondary" className="text-xs">Required for "In Season"</Badge>
                          </Label>
                          <Input
                            id={`season-${product.id}`}
                            type="text"
                            placeholder="e.g., May - September"
                            value={product.seasonalDates || ''}
                            onChange={(e) => updateSeasonalDates(product.id, e.target.value)}
                            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                          />
                          <p className="text-xs text-gray-500">
                            Enter the months when this product is naturally available
                          </p>
                        </div>
                      )}

                      <Separator />

                      {/* 8) Help text */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex gap-3">
                          <HelpCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="space-y-2 text-sm text-blue-900">
                            <p className="font-medium">Quick tips:</p>
                            <ul className="space-y-1 text-blue-800">
                              <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>Stock level changes are saved automatically</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>Products marked "Unavailable" won't appear in customer searches</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>Use "Preview as customer" to see how your products look</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
