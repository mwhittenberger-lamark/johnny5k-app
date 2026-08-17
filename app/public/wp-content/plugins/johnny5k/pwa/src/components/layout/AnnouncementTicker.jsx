export default function AnnouncementTicker({ messages = [] }) {
  const items = Array.isArray(messages) ? messages.filter(item => item?.message) : []
  if (!items.length) return null

  return (
    <aside className="johnny-wire" aria-label="Johnny Wire announcements">
      <div className="johnny-wire-label"><i aria-hidden="true" /><span>Johnny Wire</span></div>
      <div className="johnny-wire-viewport">
        <div className="johnny-wire-track">
          <TickerGroup items={items} />
          <TickerGroup items={items} duplicate />
        </div>
      </div>
    </aside>
  )
}

function TickerGroup({ items, duplicate = false }) {
  return (
    <div className="johnny-wire-group" aria-hidden={duplicate || undefined}>
      {items.map(item => {
        const content = <><strong>{item.label || 'Johnny says'}</strong><span>{item.message}</span><i aria-hidden="true">◆</i></>
        return item.url
          ? <a key={`${duplicate ? 'copy-' : ''}${item.id}`} href={item.url}>{content}</a>
          : <span className="johnny-wire-item" key={`${duplicate ? 'copy-' : ''}${item.id}`}>{content}</span>
      })}
    </div>
  )
}
