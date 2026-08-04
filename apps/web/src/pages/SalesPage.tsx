import React, { useEffect, useState } from 'react';
import { fetchWithAuth } from '../services/api';
import { formatEggCount } from '../utils/crates';
import {
  ShoppingCart, Users, DollarSign, Plus, Search, Filter,
  Phone, UserCheck, Calendar, CheckCircle2, AlertTriangle, ArrowRight, X, Trash2
} from 'lucide-react';
import { IBatch, ICustomer, ISale, IPayment, ISaleItem } from '@poultry-ops/types';

export const SalesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sales' | 'customers' | 'payments'>('sales');

  const [sales, setSales] = useState<ISale[]>([]);
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [payments, setPayments] = useState<IPayment[]>([]);
  const [batches, setBatches] = useState<IBatch[]>([]);
  const [duesSummary, setDuesSummary] = useState<any>({ totalOutstandingDue: 0, customerCountWithDue: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [newSaleModalOpen, setNewSaleModalOpen] = useState(false);
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Form states
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState<string>('');
  const [customerAddressInput, setCustomerAddressInput] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amountPaidInput, setAmountPaidInput] = useState<number>(0);
  const [saleNotesInput, setSaleNotesInput] = useState<string>('');

  // Line items for multi-item sale form (Crates + Loose Eggs for Layer, Birds + Weight for Poultry)
  const [lineItems, setLineItems] = useState<Array<{
    type: 'egg' | 'chicken';
    crates: number;
    looseEggs: number;
    birdCount: number;
    weightKg: number;
    unit: 'piece' | 'tray' | 'kg' | 'bird';
    unitPrice: number;
  }>>([
    { type: 'egg', crates: 10, looseEggs: 0, birdCount: 0, weightKg: 0, unit: 'tray', unitPrice: 360 }
  ]);

  // Payment Settlement form state
  const [paymentTargetCustomer, setPaymentTargetCustomer] = useState<ICustomer | null>(null);
  const [paymentTargetSale, setPaymentTargetSale] = useState<ISale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'bank' | 'other'>('cash');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesData, customersData, paymentsData, batchesData, duesData] = await Promise.all([
        fetchWithAuth('/sales'),
        fetchWithAuth('/customers'),
        fetchWithAuth('/payments'),
        fetchWithAuth('/batches'),
        fetchWithAuth('/reports/dues')
      ]);
      setSales(salesData);
      setCustomers(customersData);
      setPayments(paymentsData);
      setBatches(batchesData);
      setDuesSummary(duesData);
    } catch (err: any) {
      console.error('Failed to load sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Compute overall summary metrics
  const totalSalesRevenue = sales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
  const totalReceivedPayments = sales.reduce((acc, s) => acc + (s.amountPaid || 0), 0);
  const totalOutstandingDue = duesSummary.totalOutstandingDue || customers.reduce((acc, c) => acc + (c.totalDue || 0), 0);

  // Line item helpers
  const handleAddLineItem = () => {
    setLineItems(prev => [...prev, { type: 'egg', crates: 5, looseEggs: 0, birdCount: 0, weightKg: 0, unit: 'tray', unitPrice: 360 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Live money calculations for New Sale form
  const computedLineItemsSubtotals = lineItems.map(item => {
    let actualQty = 0;
    let subtotal = 0;

    if (item.type === 'egg') {
      const crates = item.crates || 0;
      const loose = item.looseEggs || 0;
      actualQty = (crates * 30) + loose;

      if (item.unit === 'tray') {
        const totalTrays = crates + (loose / 30);
        subtotal = Number((totalTrays * item.unitPrice).toFixed(2));
      } else {
        subtotal = Number((actualQty * item.unitPrice).toFixed(2));
      }
    } else {
      actualQty = item.birdCount || 0;
      if (item.unit === 'kg' && item.weightKg > 0) {
        subtotal = Number((item.weightKg * item.unitPrice).toFixed(2));
      } else {
        subtotal = Number((actualQty * item.unitPrice).toFixed(2));
      }
    }

    return { ...item, actualQty, subtotal };
  });

  const calculatedTotalAmount = Number(computedLineItemsSubtotals.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const calculatedAmountDue = Math.max(0, Number((calculatedTotalAmount - amountPaidInput).toFixed(2)));
  const calculatedStatus: 'paid' | 'partial' | 'due' = calculatedAmountDue <= 0 ? 'paid' : amountPaidInput === 0 ? 'due' : 'partial';

  // Customer fast-lookup selection
  const handleSelectCustomer = (customer: ICustomer) => {
    setSelectedCustomerId(customer._id);
    setCustomerNameInput(customer.name);
    setCustomerPhoneInput(customer.phone);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);
    try {
      const newCustomer = await fetchWithAuth('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customerNameInput,
          phone: customerPhoneInput,
          address: customerAddressInput
        })
      });
      setCustomers(prev => [...prev, newCustomer]);
      setSelectedCustomerId(newCustomer._id);
      setNewCustomerModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (lineItems.length === 0) {
      setErrorMsg('Please add at least one line item to the sale.');
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = computedLineItemsSubtotals.map(i => ({
        type: i.type,
        quantity: i.actualQty,
        crates: i.type === 'egg' ? i.crates : undefined,
        looseEggs: i.type === 'egg' ? i.looseEggs : undefined,
        birdCount: i.type === 'chicken' ? i.birdCount : undefined,
        weightKg: i.type === 'chicken' ? i.weightKg : undefined,
        unit: i.unit,
        unitPrice: i.unitPrice
      }));

      await fetchWithAuth('/sales', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId || undefined,
          customerId: selectedCustomerId || undefined,
          customerName: customerNameInput || undefined,
          customerPhone: customerPhoneInput || undefined,
          items: itemsPayload,
          date: saleDate,
          amountPaid: Number(amountPaidInput),
          notes: saleNotesInput || undefined
        })
      });

      setNewSaleModalOpen(false);
      resetSaleForm();
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record sale');
    } finally {
      setSubmitting(false);
    }
  };

  const resetSaleForm = () => {
    setSelectedBatchId('');
    setSelectedCustomerId('');
    setCustomerNameInput('');
    setCustomerPhoneInput('');
    setLineItems([{ type: 'egg', quantity: 300, unit: 'piece', unitPrice: 12 }]);
    setAmountPaidInput(0);
    setSaleNotesInput('');
  };

  const openPaymentModal = (customer: ICustomer, sale?: ISale) => {
    setPaymentTargetCustomer(customer);
    setPaymentTargetSale(sale || null);
    setPaymentAmount(sale ? sale.amountDue : customer.totalDue);
    setPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetCustomer) return;
    setErrorMsg('');
    setSubmitting(true);

    try {
      await fetchWithAuth('/payments', {
        method: 'POST',
        body: JSON.stringify({
          customerId: paymentTargetCustomer._id,
          saleId: paymentTargetSale ? paymentTargetSale._id : undefined,
          amount: Number(paymentAmount),
          date: paymentDate,
          method: paymentMethod,
          notes: paymentNotes || undefined
        })
      });

      setPaymentModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm('Are you sure you want to delete this sale record? This will adjust customer dues.')) return;
    try {
      await fetchWithAuth(`/sales/${saleId}`, { method: 'DELETE' });
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete sale');
    }
  };

  // Filtered sales list
  const filteredSales = sales.filter(s => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchesSearch = !searchQuery ||
      (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.customerPhone && s.customerPhone.includes(searchQuery));
    return matchesStatus && matchesSearch;
  });

  // Filtered customers list
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2D2A26' }}>
            Sales Ledger & Customer Dues Tracking
          </h1>
          <p style={{ color: '#6B655C', fontSize: '0.9rem' }}>
            Manage daily egg/bird sales, line items, customer phone contacts, and due payment settlements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => { setNewCustomerModalOpen(true); setErrorMsg(''); }}
            className="btn btn-secondary"
            style={{ fontWeight: 700 }}
          >
            <UserCheck size={18} /> Add Customer
          </button>
          <button
            onClick={() => { setNewSaleModalOpen(true); setErrorMsg(''); }}
            className="btn btn-primary"
            style={{ fontWeight: 700 }}
          >
            <Plus size={18} /> Record New Sale
          </button>
        </div>
      </div>

      {/* SUMMARY STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '18px', backgroundColor: '#FFFFFF', borderLeft: '5px solid #3D6B8C' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B655C', textTransform: 'uppercase' }}>Total Sales Income</span>
            <div style={{ backgroundColor: 'rgba(61, 107, 140, 0.15)', padding: '6px', borderRadius: '8px', color: '#3D6B8C' }}>
              <ShoppingCart size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2D2A26', marginTop: '8px' }}>
            ৳{totalSalesRevenue.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B655C', marginTop: '2px' }}>{sales.length} total transactions logged</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px', backgroundColor: '#FFFFFF', borderLeft: '5px solid #4A7C59' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B655C', textTransform: 'uppercase' }}>Received Payments</span>
            <div style={{ backgroundColor: 'rgba(74, 124, 89, 0.15)', padding: '6px', borderRadius: '8px', color: '#4A7C59' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4A7C59', marginTop: '8px' }}>
            ৳{totalReceivedPayments.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B655C', marginTop: '2px' }}>Cash collected at point of sale</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px', backgroundColor: '#FFFFFF', borderLeft: '5px solid #B23A2F' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B655C', textTransform: 'uppercase' }}>Outstanding Dues</span>
            <div style={{ backgroundColor: 'rgba(178, 58, 47, 0.15)', padding: '6px', borderRadius: '8px', color: '#B23A2F' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#B23A2F', marginTop: '8px' }}>
            ৳{totalOutstandingDue.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B655C', marginTop: '2px' }}>Across {duesSummary.customerCountWithDue || customers.filter(c => c.totalDue > 0).length} customers</div>
        </div>

        <div className="glass-panel" style={{ padding: '18px', backgroundColor: '#FFFFFF', borderLeft: '5px solid #D9A441' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B655C', textTransform: 'uppercase' }}>Customer Directory</span>
            <div style={{ backgroundColor: 'rgba(217, 164, 65, 0.15)', padding: '6px', borderRadius: '8px', color: '#D9A441' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2D2A26', marginTop: '8px' }}>
            {customers.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6B655C', marginTop: '2px' }}>Registered buyers with phone numbers</div>
        </div>
      </div>

      {/* TABS & SEARCH BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', borderBottom: '2px solid #E8E2D8', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('sales')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              fontWeight: activeTab === 'sales' ? 800 : 600,
              fontSize: '0.9rem',
              backgroundColor: activeTab === 'sales' ? '#C7511F' : '#F4EFE6',
              color: activeTab === 'sales' ? '#FFFFFF' : '#6B655C',
              cursor: 'pointer'
            }}
          >
            🏷️ 1. Sales Ledger ({sales.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              fontWeight: activeTab === 'customers' ? 800 : 600,
              fontSize: '0.9rem',
              backgroundColor: activeTab === 'customers' ? '#C7511F' : '#F4EFE6',
              color: activeTab === 'customers' ? '#FFFFFF' : '#6B655C',
              cursor: 'pointer'
            }}
          >
            👥 2. Customer Dues ({customers.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px 10px 0 0',
              border: 'none',
              fontWeight: activeTab === 'payments' ? 800 : 600,
              fontSize: '0.9rem',
              backgroundColor: activeTab === 'payments' ? '#C7511F' : '#F4EFE6',
              color: activeTab === 'payments' ? '#FFFFFF' : '#6B655C',
              cursor: 'pointer'
            }}
          >
            💳 3. Payment History ({payments.length})
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#6B655C' }} />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '36px', fontSize: '0.85rem', width: '220px' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#6B655C' }}>Loading Sales & Customer Ledger...</div>
      ) : (
        <>
          {/* TAB 1: SALES LEDGER */}
          {activeTab === 'sales' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6B655C' }}>Status Filter:</span>
                {['all', 'due', 'partial', 'paid'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: statusFilter === st ? 800 : 600,
                      backgroundColor: statusFilter === st ? '#2D2A26' : '#F4EFE6',
                      color: statusFilter === st ? '#FFFFFF' : '#6B655C',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {filteredSales.length > 0 ? (
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F4EFE6', textAlign: 'left', borderBottom: '1px solid #E8E2D8' }}>
                        <th style={{ padding: '12px 16px' }}>Date</th>
                        <th style={{ padding: '12px 16px' }}>Customer</th>
                        <th style={{ padding: '12px 16px' }}>Line Items</th>
                        <th style={{ padding: '12px 16px' }}>Total Amount</th>
                        <th style={{ padding: '12px 16px' }}>Paid</th>
                        <th style={{ padding: '12px 16px' }}>Due Balance</th>
                        <th style={{ padding: '12px 16px' }}>Status</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map(sale => {
                        const cust = customers.find(c => c._id === sale.customerId);
                        return (
                          <tr key={sale._id} style={{ borderBottom: '1px solid #E8E2D8' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600 }}>{sale.date}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ fontWeight: 800, color: '#2D2A26' }}>{sale.customerName || 'Walk-in Customer'}</div>
                              {sale.customerPhone && (
                                <div style={{ fontSize: '0.78rem', color: '#6B655C', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Phone size={12} /> {sale.customerPhone}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {sale.items && sale.items.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {sale.items.map((item, idx) => (
                                    <div key={idx} style={{ fontSize: '0.82rem' }}>
                                      {item.type === 'egg' ? '🥚' : '🐔'} {item.type === 'egg' ? formatEggCount(item.quantity) : `${item.quantity} birds`} @ ৳{item.unitPrice}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>{sale.itemType === 'egg' ? '🥚' : '🐔'} {sale.quantity} @ ৳{sale.unitPrice}</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 800, color: '#2D2A26' }}>
                              ৳{sale.totalAmount.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: '#4A7C59' }}>
                              ৳{sale.amountPaid.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 800, color: sale.amountDue > 0 ? '#B23A2F' : '#6B655C' }}>
                              ৳{sale.amountDue.toLocaleString()}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {sale.status === 'paid' && <span className="badge badge-emerald">PAID</span>}
                              {sale.status === 'partial' && <span className="badge" style={{ backgroundColor: 'rgba(217, 164, 65, 0.15)', color: '#D9A441' }}>PARTIAL DUE</span>}
                              {sale.status === 'due' && <span className="badge badge-rose">UNPAID DUE</span>}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                {sale.amountDue > 0 && cust && (
                                  <button
                                    onClick={() => openPaymentModal(cust, sale)}
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                                  >
                                    Settle Due
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteSale(sale._id)}
                                  style={{ background: 'none', border: 'none', color: '#B23A2F', cursor: 'pointer', padding: '4px' }}
                                  title="Delete Sale Record"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#6B655C' }}>
                  No sales transactions found matching criteria.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CUSTOMER DIRECTORY & DUES */}
          {activeTab === 'customers' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {filteredCustomers.map(cust => {
                const customerSales = sales.filter(s => s.customerId === cust._id);
                const totalPurchases = customerSales.reduce((sum, s) => sum + s.totalAmount, 0);

                return (
                  <div
                    key={cust._id}
                    className="glass-panel"
                    style={{
                      padding: '20px',
                      backgroundColor: '#FFFFFF',
                      borderTop: `4px solid ${cust.totalDue > 0 ? '#B23A2F' : '#4A7C59'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2D2A26' }}>{cust.name}</h3>
                        <div style={{ fontSize: '0.85rem', color: '#6B655C', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <Phone size={14} color="#C7511F" />
                          <strong>{cust.phone}</strong>
                        </div>
                        {cust.address && (
                          <div style={{ fontSize: '0.78rem', color: '#6B655C', marginTop: '2px' }}>
                            📍 {cust.address}
                          </div>
                        )}
                      </div>

                      <span className="badge" style={{ backgroundColor: cust.totalDue > 0 ? 'rgba(178, 58, 47, 0.15)' : 'rgba(74, 124, 89, 0.15)', color: cust.totalDue > 0 ? '#B23A2F' : '#4A7C59', fontWeight: 800 }}>
                        {cust.totalDue > 0 ? `৳${cust.totalDue.toLocaleString()} DUE` : 'CLEARED'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: '#F4EFE6', borderRadius: '10px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#6B655C' }}>Lifetime Purchases:</span>
                        <strong style={{ color: '#2D2A26' }}>৳{totalPurchases.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#6B655C' }}>Total Orders:</span>
                        <strong>{customerSales.length} invoices</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: '#6B655C' }}>Current Outstanding Due:</span>
                        <strong style={{ color: cust.totalDue > 0 ? '#B23A2F' : '#4A7C59' }}>৳{cust.totalDue.toLocaleString()}</strong>
                      </div>
                    </div>

                    {cust.totalDue > 0 ? (
                      <button
                        onClick={() => openPaymentModal(cust)}
                        className="btn btn-primary"
                        style={{ width: '100%', justifyContent: 'center', fontWeight: 700 }}
                      >
                        <DollarSign size={16} /> Record Due Payment
                      </button>
                    ) : (
                      <button
                        disabled
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', opacity: 0.6 }}
                      >
                        <CheckCircle2 size={16} /> No Due Balance
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: PAYMENT HISTORY LEDGER */}
          {activeTab === 'payments' && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F4EFE6', textAlign: 'left', borderBottom: '1px solid #E8E2D8' }}>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Customer</th>
                    <th style={{ padding: '12px 16px' }}>Payment Method</th>
                    <th style={{ padding: '12px 16px' }}>Amount Paid</th>
                    <th style={{ padding: '12px 16px' }}>Notes / Description</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(pmt => (
                    <tr key={pmt._id} style={{ borderBottom: '1px solid #E8E2D8' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{pmt.date}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: '#2D2A26' }}>{pmt.customerName || 'Customer'}</div>
                        {pmt.customerPhone && <div style={{ fontSize: '0.78rem', color: '#6B655C' }}>📞 {pmt.customerPhone}</div>}
                      </td>
                      <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontWeight: 700, color: '#3D6B8C' }}>
                        {pmt.method || 'cash'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#4A7C59', fontSize: '1.05rem' }}>
                        ৳{pmt.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6B655C', fontSize: '0.82rem' }}>
                        {pmt.notes || 'Payment against customer due'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* NEW MULTI-ITEM SALE MODAL */}
      {newSaleModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2D2A26' }}>🛒 Record New Sales Invoice</h2>
              <button onClick={() => setNewSaleModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B655C' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(178, 58, 47, 0.15)', color: '#B23A2F', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateSale} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Batch & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Select Flock / Batch</label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">General Farm Sale (All Flocks)</option>
                    {batches.map(b => (
                      <option key={b._id} value={b._id}>{b.name} ({b.breed})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Sale Date *</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              {/* Customer Selection / Fast Lookup */}
              <div style={{ backgroundColor: '#F4EFE6', padding: '16px', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2D2A26', marginBottom: '10px' }}>
                  👥 CUSTOMER SELECTION (Fast-Path Phone Lookup)
                </div>

                {/* Existing Customer Dropdown */}
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '0.78rem', color: '#6B655C', fontWeight: 600 }}>Select Saved Customer:</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      const cust = customers.find(c => c._id === e.target.value);
                      if (cust) handleSelectCustomer(cust);
                      else { setSelectedCustomerId(''); setCustomerNameInput(''); setCustomerPhoneInput(''); }
                    }}
                    className="input-field"
                    style={{ marginTop: '4px' }}
                  >
                    <option value="">-- Choose Existing Customer or Enter Below --</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.phone}) - {c.totalDue > 0 ? `Due: ৳${c.totalDue}` : 'No Due'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Manual Name & Phone Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#6B655C', fontWeight: 600 }}>Customer Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahim Merchant"
                      value={customerNameInput}
                      onChange={(e) => setCustomerNameInput(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#6B655C', fontWeight: 600 }}>Phone Number (Required for Dues) *</label>
                    <input
                      type="tel"
                      placeholder="e.g. 01712345678"
                      value={customerPhoneInput}
                      onChange={(e) => setCustomerPhoneInput(e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>

              {/* LINE ITEMS BUILDER */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Line Items (Eggs & Birds)</label>
                  <button type="button" onClick={handleAddLineItem} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                    <Plus size={14} /> Add Item Line
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {lineItems.map((item, idx) => {
                    const computed = computedLineItemsSubtotals[idx] || { actualQty: 0, subtotal: 0 };
                    return (
                      <div key={idx} style={{ backgroundColor: '#F4EFE6', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <select
                            value={item.type}
                            onChange={(e) => handleLineItemChange(idx, 'type', e.target.value)}
                            className="input-field"
                            style={{ padding: '6px 10px', fontWeight: 800, width: '180px' }}
                          >
                            <option value="egg">🥚 Layer Eggs</option>
                            <option value="chicken">🐔 Poultry / Birds</option>
                          </select>

                          {lineItems.length > 1 && (
                            <button type="button" onClick={() => handleRemoveLineItem(idx)} style={{ background: 'none', border: 'none', color: '#B23A2F', cursor: 'pointer' }}>
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>

                        {/* INPUTS FOR EGG (LAYER) */}
                        {item.type === 'egg' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Crates (30 eggs)</label>
                              <input
                                type="number"
                                placeholder="Crates"
                                value={item.crates}
                                onChange={(e) => handleLineItemChange(idx, 'crates', Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                                min="0"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Loose Eggs</label>
                              <input
                                type="number"
                                placeholder="Loose"
                                value={item.looseEggs}
                                onChange={(e) => handleLineItemChange(idx, 'looseEggs', Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                                min="0"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Pricing Unit</label>
                              <select
                                value={item.unit}
                                onChange={(e) => handleLineItemChange(idx, 'unit', e.target.value)}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                              >
                                <option value="tray">Per Crate ৳</option>
                                <option value="piece">Per Piece ৳</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Unit Price ৳</label>
                              <input
                                type="number"
                                placeholder="Price"
                                value={item.unitPrice}
                                onChange={(e) => handleLineItemChange(idx, 'unitPrice', Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>
                        ) : (
                          /* INPUTS FOR POULTRY / CHICKEN */
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Bird Count</label>
                              <input
                                type="number"
                                placeholder="Birds"
                                value={item.birdCount}
                                onChange={(e) => handleLineItemChange(idx, 'birdCount', Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                                min="0"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Total Weight (kg)</label>
                              <input
                                type="number"
                                placeholder="Weight kg"
                                value={item.weightKg}
                                onChange={(e) => handleLineItemChange(idx, 'weightKg', Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                                min="0"
                                step="0.1"
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Pricing Unit</label>
                              <select
                                value={item.unit}
                                onChange={(e) => handleLineItemChange(idx, 'unit', e.target.value)}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                              >
                                <option value="kg">Per kg ৳</option>
                                <option value="bird">Per Bird ৳</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B655C' }}>Unit Price ৳</label>
                              <input
                                type="number"
                                placeholder="Price"
                                value={item.unitPrice}
                                onChange={(e) => handleLineItemChange(idx, 'unitPrice', Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '6px 8px' }}
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>
                        )}

                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#3D6B8C', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: '6px' }}>
                          <span>
                            {item.type === 'egg'
                              ? `🥚 Total Eggs: ${computed.actualQty} eggs (${item.crates || 0} Crates + ${item.looseEggs || 0} Loose)`
                              : `🐔 Total Poultry: ${item.birdCount || 0} birds (${item.weightKg || 0} kg)`
                            }
                          </span>
                          <strong style={{ color: '#4A7C59', fontSize: '0.95rem' }}>Subtotal: ৳{computed.subtotal.toLocaleString()}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LIVE MONEY CALCULATIONS SUMMARY */}
              <div style={{ backgroundColor: '#FAF7F2', padding: '16px', borderRadius: '12px', border: '1px solid #E8E2D8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span style={{ fontWeight: 700, color: '#6B655C' }}>Total Invoice Amount:</span>
                  <strong style={{ fontSize: '1.2rem', color: '#2D2A26' }}>৳{calculatedTotalAmount.toLocaleString()}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <div>
                    <label className="label">Amount Paid Now (৳)</label>
                    <input
                      type="number"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(Number(e.target.value))}
                      className="input-field"
                      min="0"
                      max={calculatedTotalAmount}
                    />
                  </div>

                  <div>
                    <label className="label">Remaining Due Balance (৳)</label>
                    <div style={{ padding: '10px 14px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E8E2D8', fontWeight: 800, fontSize: '1.1rem', color: calculatedAmountDue > 0 ? '#B23A2F' : '#4A7C59', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>৳{calculatedAmountDue.toLocaleString()}</span>
                      <span className="badge" style={{ backgroundColor: calculatedStatus === 'paid' ? 'rgba(74, 124, 89, 0.15)' : 'rgba(178, 58, 47, 0.15)', color: calculatedStatus === 'paid' ? '#4A7C59' : '#B23A2F', fontSize: '0.75rem' }}>
                        {calculatedStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Notes / Customer Terms</label>
                <input
                  type="text"
                  placeholder="Optional notes or payment terms"
                  value={saleNotesInput}
                  onChange={(e) => setSaleNotesInput(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setNewSaleModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {submitting ? 'Recording Sale...' : 'Save & Print Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW CUSTOMER MODAL */}
      {newCustomerModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: '450px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2D2A26' }}>👤 Add New Customer</h2>
              <button onClick={() => setNewCustomerModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B655C' }}>
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(178, 58, 47, 0.15)', color: '#B23A2F', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Customer Name *</label>
                <input
                  type="text"
                  placeholder="Full Name / Business Name"
                  value={customerNameInput}
                  onChange={(e) => setCustomerNameInput(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">Phone Number (Required) *</label>
                <input
                  type="tel"
                  placeholder="e.g. 01712345678"
                  value={customerPhoneInput}
                  onChange={(e) => setCustomerPhoneInput(e.target.value)}
                  className="input-field"
                  required
                />
                <p style={{ fontSize: '0.75rem', color: '#6B655C', marginTop: '2px' }}>Phone number is required and must be unique per farm.</p>
              </div>

              <div>
                <label className="label">Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Gazipur Wholesale Market"
                  value={customerAddressInput}
                  onChange={(e) => setCustomerAddressInput(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setNewCustomerModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {submitting ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT SETTLEMENT MODAL */}
      {paymentModalOpen && paymentTargetCustomer && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div className="glass-panel" style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2D2A26' }}>💳 Record Due Payment Settlement</h2>
              <button onClick={() => setPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B655C' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '12px', backgroundColor: '#F4EFE6', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2D2A26' }}>{paymentTargetCustomer.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6B655C' }}>📞 {paymentTargetCustomer.phone}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#B23A2F', marginTop: '4px' }}>
                Total Current Due Balance: ৳{paymentTargetCustomer.totalDue.toLocaleString()}
              </div>
            </div>

            {errorMsg && (
              <div style={{ padding: '10px 14px', backgroundColor: 'rgba(178, 58, 47, 0.15)', color: '#B23A2F', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 700 }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label">Payment Amount (৳) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="input-field"
                  min="1"
                  max={paymentTargetCustomer.totalDue}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label className="label">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="label">Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="input-field"
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="bkash">📱 bKash</option>
                    <option value="bank">🏦 Bank Transfer</option>
                    <option value="other">📝 Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. bKash TrxID #8X92K"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setPaymentModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {submitting ? 'Recording...' : 'Submit Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
