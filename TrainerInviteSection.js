// TrainerInviteSection.js — paste into App.js before ProfileScreen function

function TrainerInviteSection({ member, onTrainerLinked }) {
  const [invitesEnabled, setInvitesEnabled] = React.useState(member?.acceptingTrainerInvites ?? false);
  const [linkInput, setLinkInput] = React.useState('');
  const [linkResult, setLinkResult] = React.useState(null);
  const [pendingInvites, setPendingInvites] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [linkLoading, setLinkLoading] = React.useState(false);

  React.useEffect(() => {
    if (!member?.id) return;
    const q = query(collection(db, 'trainerInvites'), where('memberId', '==', member.id), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, snap => setPendingInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [member?.id]);

  const handleToggle = async () => {
    const v = !invitesEnabled;
    setInvitesEnabled(v);
    if (member?.id) await updateDoc(doc(db, 'members', member.id), { acceptingTrainerInvites: v }).catch(() => {});
  };

  const handleLinkLookup = async () => {
    const input = linkInput.trim();
    if (!input) return;
    setLinkLoading(true); setLinkResult(null);
    try {
      const code = input.includes('/') ? input.split('/').pop().toUpperCase() : input.toUpperCase();
      const snap = await getDocs(query(collection(db, 'freelanceInvites'), where('inviteCode', '==', code)));
      if (snap.empty) { Alert.alert('Not Found', 'Invalid or expired invite link.'); return; }
      const invite = snap.docs[0].data();
      const inviteId = snap.docs[0].id;
      const trainerSnap = await getDoc(doc(db, 'trainers', invite.trainerId));
      const trainerName = trainerSnap.data()?.fullName ?? trainerSnap.data()?.name ?? 'Trainer';
      setLinkResult({ trainerId: invite.trainerId, trainerName, inviteId, monthlyFee: invite.monthlyFee });
    } catch (e) { Alert.alert('Error', 'Could not look up invite.'); }
    finally { setLinkLoading(false); }
  };

  const acceptInvite = async (trainerId, inviteId) => {
    const trainerSnap = await getDoc(doc(db, 'trainers', trainerId));
    const trainer = trainerSnap.data();
    await updateDoc(doc(db, 'members', member.id), {
      trainerId, trainerName: trainer?.fullName ?? trainer?.name ?? '', gymId: trainer?.gymId ?? null, updatedAt: Date.now(),
    });
    await updateDoc(doc(db, 'trainerInvites', inviteId), { status: 'accepted', acceptedAt: Date.now() }).catch(() => {});
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      id: notifRef.id, recipientId: trainerId, type: 'client_invited_accepted',
      title: 'New Client Connected', body: `${member.name} accepted your invite`,
      isRead: false, read: false, createdAt: Date.now(),
    });
    onTrainerLinked({ trainerId, trainer: trainer?.fullName ?? trainer?.name ?? 'Trainer', gymId: trainer?.gymId ?? null });
  };

  const handleAcceptLink = async () => {
    if (!linkResult || !member?.id) return;
    setLoading(true);
    try {
      await acceptInvite(linkResult.trainerId, linkResult.inviteId);
      setLinkResult(null); setLinkInput('');
      Alert.alert('✅ Connected!', `You are now connected with ${linkResult.trainerName}.`);
    } catch (e) { Alert.alert('Error', 'Failed to accept invite.'); }
    finally { setLoading(false); }
  };

  const handleRespond = async (invite, accept) => {
    setLoading(true);
    try {
      if (accept) {
        await acceptInvite(invite.trainerId, invite.id);
        Alert.alert('✅ Connected!', `You are now connected with ${invite.trainerName}.`);
      } else {
        await updateDoc(doc(db, 'trainerInvites', invite.id), { status: 'rejected', rejectedAt: Date.now() });
      }
    } catch (e) { Alert.alert('Error', 'Failed to process invite.'); }
    finally { setLoading(false); }
  };

  return (
    <View>
      <Text style={g.sec}>Trainer Invites</Text>
      <View style={ti.card}>
        <View style={ti.row}>
          <View style={{ flex: 1 }}>
            <Text style={ti.label}>Accept Trainer Invites</Text>
            <Text style={ti.sub}>{invitesEnabled ? 'Trainers can find and invite you' : 'Turn on to receive trainer invites'}</Text>
          </View>
          <TouchableOpacity style={[ti.toggle, invitesEnabled && ti.toggleOn]} onPress={handleToggle} activeOpacity={0.8}>
            <View style={[ti.knob, invitesEnabled && ti.knobOn]} />
          </TouchableOpacity>
        </View>

        {pendingInvites.length > 0 && (<>
          <View style={ti.divider} />
          <Text style={ti.sectionLabel}>Pending Invites</Text>
          {pendingInvites.map(inv => (
            <View key={inv.id} style={ti.inviteCard}>
              <View style={ti.avatar}><Text style={ti.avatarText}>{(inv.trainerName ?? 'T')[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={ti.inviteName}>{inv.trainerName}</Text>
                <Text style={ti.inviteSub}>{inv.monthlyFee ? `₹${inv.monthlyFee}/month` : 'Training invite'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity style={[ti.btn, ti.btnReject]} onPress={() => handleRespond(inv, false)} disabled={loading}>
                  <Text style={ti.btnRejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ti.btn, ti.btnAccept]} onPress={() => handleRespond(inv, true)} disabled={loading}>
                  <Text style={ti.btnAcceptText}>{loading ? '…' : 'Accept'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>)}

        <View style={ti.divider} />
        <Text style={ti.label}>Have an invite link?</Text>
        <Text style={ti.sub}>{invitesEnabled ? 'Paste the link or code from your trainer' : 'Enable invites above, then paste your trainer\'s link'}</Text>
        <View style={[ti.row, { marginTop: 8 }]}>
          <TextInput style={[ti.linkInput, !invitesEnabled && { opacity: 0.5 }]}
            placeholder={invitesEnabled ? 'Paste invite link or code…' : 'Enable invites first'}
            placeholderTextColor={C.mid} value={linkInput} onChangeText={setLinkInput}
            editable={invitesEnabled} autoCapitalize="none" autoCorrect={false} />
          <TouchableOpacity style={[ti.goBtn, (!invitesEnabled || !linkInput.trim()) && ti.goBtnOff]}
            onPress={handleLinkLookup} disabled={!invitesEnabled || !linkInput.trim() || linkLoading}>
            <Text style={ti.goBtnText}>{linkLoading ? '…' : 'Go'}</Text>
          </TouchableOpacity>
        </View>

        {linkResult && (
          <View style={ti.resultCard}>
            <View style={ti.avatar}><Text style={ti.avatarText}>{(linkResult.trainerName ?? 'T')[0].toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={ti.inviteName}>{linkResult.trainerName}</Text>
              <Text style={ti.inviteSub}>{linkResult.monthlyFee ? `₹${linkResult.monthlyFee}/month` : 'Personal Trainer'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity style={[ti.btn, ti.btnReject]} onPress={() => { setLinkResult(null); setLinkInput(''); }} disabled={loading}>
                <Text style={ti.btnRejectText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ti.btn, ti.btnAccept]} onPress={handleAcceptLink} disabled={loading}>
                <Text style={ti.btnAcceptText}>{loading ? '…' : 'Accept'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const ti = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, elevation: 1, borderWidth: 1, borderColor: C.light, gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  label: { fontSize: 15, fontWeight: '700', color: C.dark },
  sub: { fontSize: 12, color: C.mid, marginTop: 2 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: C.light, justifyContent: 'center', padding: 3 },
  toggleOn: { backgroundColor: C.primary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.card },
  knobOn: { alignSelf: 'flex-end' },
  divider: { height: 1, backgroundColor: C.light, marginVertical: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.mid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#BBF7D0' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  inviteName: { fontSize: 14, fontWeight: '700', color: C.dark },
  inviteSub: { fontSize: 12, color: C.mid, marginTop: 2 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnAccept: { backgroundColor: C.primary },
  btnAcceptText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnReject: { backgroundColor: C.light },
  btnRejectText: { color: C.mid, fontWeight: '600', fontSize: 13 },
  linkInput: { flex: 1, backgroundColor: C.bg, borderRadius: 10, padding: 12, fontSize: 14, color: C.dark, borderWidth: 1, borderColor: C.light },
  goBtn: { backgroundColor: C.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  goBtnOff: { backgroundColor: C.light },
  goBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});