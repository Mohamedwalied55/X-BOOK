let token = localStorage.getItem('xbookToken') || localStorage.getItem('adminToken') || '';

async function updateOrderStatusWithWA(id) {
  const statusEl = document.getElementById(`status-${id}`);
  if (!statusEl) return;
  const status = statusEl.value;

  try {
    const res = await fetch('/api/admin/orders/' + id, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      if (typeof toast === 'function') toast('تم تحديث حالة الطلب بنجاح');
      if (data.whatsapp_link) {
        window.open(data.whatsapp_link, '_blank');
      }
    } else {
      alert(data.error || 'تعذر التحديث');
    }
  } catch (err) {
    alert('حدث خطأ أثناء الاتصال بالخادم');
  }
}
