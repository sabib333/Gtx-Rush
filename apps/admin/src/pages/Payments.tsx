/**
 * GTX Rush — Admin Payments & Revenue Page
 */

export function Payments() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">💳 Payments & Revenue</h1>
        <p className="text-gray-500 text-sm mt-1">Revenue overview and payment operations</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Stars Revenue</div>
          <div className="text-xl font-bold text-white">$4,250</div>
          <div className="text-[10px] text-gray-600">GROSS</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Ad Revenue</div>
          <div className="text-xl font-bold text-white">$1,890</div>
          <div className="text-[10px] text-gray-600">ESTIMATED</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-xl font-bold text-yellow-400">$6,140</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Net Revenue</div>
          <div className="text-xl font-bold text-green-400">$5,505</div>
          <div className="text-[10px] text-gray-600">NET (after platform fees)</div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Purchases</div>
          <div className="text-xl font-bold text-white">1,280</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">ARPU</div>
          <div className="text-xl font-bold text-white">$0.034</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
          <div className="text-xs text-gray-500">Conversion Rate</div>
          <div className="text-xl font-bold text-white">4.2%</div>
        </div>
      </div>

      {/* Ad Operations */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Ad Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">Impressions</div>
            <div className="text-lg font-bold text-white">45,000</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Rewarded Completions</div>
            <div className="text-lg font-bold text-white">12,000</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Fill Rate</div>
            <div className="text-lg font-bold text-white">92%</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Reward Cost</div>
            <div className="text-lg font-bold text-red-400">$600</div>
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Payments</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Product</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Amount</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-2 text-xs text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody>
            {[
              { user: 'speedking', product: '50 Stars Pack', amount: '50 XTR', status: 'completed', date: '2024-08-20' },
              { user: 'quizmaster', product: '100 Stars Pack', amount: '100 XTR', status: 'completed', date: '2024-08-19' },
              { user: 'taptitan', product: '50 Stars Pack', amount: '50 XTR', status: 'failed', date: '2024-08-18' },
            ].map((p, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="px-4 py-2 text-sm text-white">{p.user}</td>
                <td className="px-4 py-2 text-sm text-gray-400">{p.product}</td>
                <td className="px-4 py-2 text-sm text-gray-300">{p.amount}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-500">{p.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
