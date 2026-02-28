import { useLang } from "../../contexts/LangContext";
import { formatAmount, formatDateShort, dicebearUrl } from "../../utils/utils";

export default function ReceiptCard({ receipt, people, currency, onEdit, onDelete }) {
  const { tr, t } = useLang();
  const payer = people.find(p => p.id === receipt.payerId);
  const items = receipt.items || [];
  const participantIds = items.length > 0
    ? [...new Set(items.flatMap(i => i.eaters || []))]
    : (receipt.participants || []);

  return (
    <div className="receipt-card card card-hover" onClick={onEdit}>
      <div className="receipt-card-top">
        <div className="receipt-card-left">
          <div className="receipt-card-name">{receipt.restaurantName || "Expense"}</div>
          <div className="receipt-card-date">{formatDateShort(receipt.date)}</div>
          {receipt.googleMapLink && (
            <a href={receipt.googleMapLink} target="_blank" rel="noopener"
              className="receipt-map-link" onClick={e => e.stopPropagation()}>
              {tr.viewOnMap}
            </a>
          )}
        </div>
        <div className="receipt-card-right">
          <div className="receipt-amount amount">
            {formatAmount(receipt.totalAmount, currency)}
          </div>
          {payer && (
            <div className="receipt-payer">
              <img src={payer.avatarUrl || dicebearUrl(payer.name)} alt={payer.name}
                className="avatar avatar-sm" />
              <span>{payer.name}</span>
            </div>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="receipt-items-preview">
          {items.slice(0, 3).map((item, i) => (
            <div key={i} className="receipt-item-row">
              <span className="receipt-item-name">{item.name}</span>
              <span className="receipt-item-price amount">{formatAmount(item.price, currency)}</span>
              <div className="receipt-item-eaters">
                {(item.eaters || []).map(eid => {
                  const p = people.find(x => x.id === eid);
                  return p ? <img key={eid} src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
                    className="avatar" style={{width:20,height:20}} title={p.name} /> : null;
                })}
              </div>
            </div>
          ))}
          {items.length > 3 && (
            <div className="receipt-more">{t(tr.moreItems, items.length - 3)}</div>
          )}
        </div>
      )}

      <div className="receipt-card-footer">
        <div className="receipt-participants">
          {participantIds.slice(0,6).map(pid => {
            const p = people.find(x => x.id === pid);
            return p ? <img key={pid} src={p.avatarUrl || dicebearUrl(p.name)} alt={p.name}
              className="avatar" style={{width:24,height:24,marginLeft:-6,border:"2px solid white"}} title={p.name} /> : null;
          })}
          {participantIds.length > 6 && (
            <span style={{fontSize:11,color:"var(--ink-muted)",marginLeft:4}}>+{participantIds.length-6}</span>
          )}
        </div>
        <button className="btn btn-icon btn-sm" onClick={e => { e.stopPropagation(); onDelete(); }}>🗑</button>
      </div>
    </div>
  );
}
