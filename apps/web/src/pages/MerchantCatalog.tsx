import { useState, useEffect } from 'react';
import { Package, Search, Filter, Sparkles, Check, Truck, Star } from 'lucide-react';
import { merchantApi } from '../lib/api';

const MERCHANTS = [
  { id: 'merchant-runpro', name: 'RunPro Sports' },
  { id: 'merchant-technest', name: 'TechNest' },
  { id: 'merchant-campusmart', name: 'CampusMart' },
  { id: 'merchant-fitfuel', name: 'FitFuel' },
];

export default function MerchantCatalog() {
  const [selectedMerchant, setSelectedMerchant] = useState(MERCHANTS[0].id);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    merchantApi.getCatalog(selectedMerchant)
      .then(setProducts)
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [selectedMerchant]);

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category)))];

  const filtered = products.filter(p => {
    const matchesSearch = search
      ? p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase())
      : true;

    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>AI-Readable Product Catalog</h1>
          <p>Structured product inventory exposed to autonomous AI buyers for discovery and negotiation</p>
        </div>
        <span className="badge badge-green">Machine-Readable Schema</span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <select
          className="form-input"
          value={selectedMerchant}
          onChange={(e) => {
            setSelectedMerchant(e.target.value);
            setCategoryFilter('ALL');
          }}
          style={{ width: 220, fontWeight: 600 }}
        >
          {MERCHANTS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Search catalog by keyword, size, or feature..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 38 }}
          />
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${categoryFilter === cat ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {!loaded ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <p style={{ color: 'var(--text-secondary)' }}>No products matching "{search}".</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map((product) => {
            const discount = product.original_price > product.price
              ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
              : 0;

            return (
              <div key={product.id} className="product-card">
                <div className="product-card-header">
                  <span className="product-card-title">{product.title}</span>
                  <span className="badge badge-green" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Sparkles size={10} /> AI Ready
                  </span>
                </div>

                <div className="product-card-merchant" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0 10px 0' }}>
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>{product.category.replace(/_/g, ' ')}</span>
                  {product.subcategory && (
                    <span className="badge badge-blue" style={{ fontSize: 10 }}>{product.subcategory.replace(/_/g, ' ')}</span>
                  )}
                  {discount > 0 && (
                    <span className="badge badge-amber" style={{ fontSize: 10 }}>{discount}% OFF</span>
                  )}
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
                  {product.description}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 'auto' }}>
                  <div>
                    <span className="product-card-price">₹{product.price}</span>
                    {product.original_price > product.price && (
                      <span className="product-card-original-price">₹{product.original_price}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <Package size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: product.stock > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                      {product.stock > 0 ? `${product.stock} units` : 'Out of stock'}
                    </span>
                  </div>
                </div>

                <div className="product-card-rating" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={13} style={{ fill: 'var(--warning)', color: 'var(--warning)' }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{product.rating}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
                    <Truck size={13} />
                    <span>{product.delivery_days} day delivery</span>
                  </div>
                </div>

                {/* Available Variants */}
                {product.variants && product.variants.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Available Variants:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {product.variants.slice(0, 4).map((v: any) => (
                        <span key={v.id} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          {v.name} ({v.stock} in stock)
                        </span>
                      ))}
                      {product.variants.length > 4 && (
                        <span style={{ fontSize: 11, padding: '3px 6px', color: 'var(--text-muted)' }}>+{product.variants.length - 4} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
