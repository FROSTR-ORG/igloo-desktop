# Initial Ping Sweep Feature

## Issue Addressed

When the signer started, all peers would initially show as "offline" even if they were actually online and reachable. Users had to manually click the refresh button to discover which peers were actually online, creating an extra step and poor initial user experience.

## Solution Implemented

### **Automatic Initial Ping Sweep**

Added an automatic ping sweep that runs immediately after the peer list initializes to detect which peers are online without requiring user interaction.

## How It Works

### **1. Initialization Sequence**
```typescript
1. Signer starts and peer list initializes
2. Peers extracted from group credentials (all marked as offline initially)
3. Ping event listeners set up for real-time updates
4. 500ms delay to ensure everything is ready
5. Initial ping sweep begins automatically
6. UI shows "Detecting online peers..." with pulsing radio icon
7. All peers pinged concurrently with 2-second timeout
8. Peer status updated in real-time as responses come in
9. Sweep completes and normal operation continues
```

### **2. Visual Feedback**
- **Loading State**: "Detecting online peers..." with animated radio icon
- **Real-time Updates**: Peers change from offline to online as they respond
- **Seamless Transition**: Automatically transitions to normal peer list view

### **3. Technical Implementation**
```typescript
// Perform initial ping sweep after 500ms delay
setTimeout(async () => {
  setIsInitialPingSweep(true);
  
  const pingPromises = initialPeers.map(async (peer) => {
    const result = await Promise.race([
      node.req.ping(normalizedPubkey),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
    
    if (result.ok) {
      // Update peer as online with latency
      setPeers(prev => /* update online status */);
    }
  });
  
  await Promise.allSettled(pingPromises);
  setIsInitialPingSweep(false);
}, 500);
```

## User Experience Improvements

### **Before (Manual Detection)**
1. ❌ Start signer → All peers show as "offline"
2. ❌ User must manually click refresh button
3. ❌ Peers suddenly change to "online" after refresh
4. ❌ Extra step required for basic functionality

### **After (Automatic Detection)**
1. ✅ Start signer → Brief "Detecting online peers..." message
2. ✅ Peers automatically detected as online within 1-2 seconds
3. ✅ Real-time status updates as responses arrive
4. ✅ No user interaction required

## Technical Details

### **Timing and Performance**
- **Initialization Delay**: 500ms to ensure peer manager is ready
- **Ping Timeout**: 2 seconds (shorter than manual pings for faster initial detection)
- **Concurrent Pings**: All peers pinged simultaneously for speed
- **Error Handling**: Graceful handling of timeouts and "peer data not found" errors

### **State Management**
- **isInitialPingSweep**: New state to track when initial sweep is running
- **Clean Transitions**: Proper state cleanup when component unmounts
- **Real-time Updates**: Peer status updates immediately as responses arrive

### **Error Handling**
- **Graceful Timeouts**: Expected timeouts handled silently
- **Peer Discovery**: "Peer data not found" errors handled gracefully
- **Network Issues**: Component continues to work even if initial sweep fails

## Benefits

### **1. Better First Impression**
- Users immediately see which peers are online
- No confusion about peer availability
- Professional, polished user experience

### **2. Reduced User Friction**
- Eliminates need to manually refresh
- Automatic detection works seamlessly
- One less step for users to remember

### **3. Real-time Feedback**
- Visual loading indicator shows progress
- Peers update in real-time as they respond
- Clear indication that the system is working

### **4. Network Awareness**
- Fast detection of available peers
- Immediate insight into network connectivity
- Better understanding of peer availability

## Implementation Notes

### **Timing Considerations**
- **500ms delay**: Ensures peer manager and node are fully initialized
- **2-second timeout**: Faster than manual pings for quicker initial results
- **Concurrent execution**: All pings happen simultaneously for speed

### **Visual Design**
- **Consistent with existing UI**: Uses same loading patterns
- **Clear messaging**: "Detecting online peers..." is self-explanatory
- **Appropriate icons**: Radio icon indicates network activity

### **Cleanup and Safety**
- **Component unmount**: Proper cleanup of state when component unmounts
- **Signer stop**: Reset state when signer stops running
- **Active checks**: Ensures updates only happen when component is still active

## Testing

The feature can be verified by:
1. Starting the signer with valid credentials
2. Observing the brief "Detecting online peers..." message
3. Watching peers automatically change from offline to online
4. Confirming no manual refresh is needed
5. Verifying latency measurements are captured during initial sweep

## Future Enhancements

Potential improvements:
- **Progressive timeout**: Start with shorter timeouts and retry with longer ones
- **Smart retry**: Retry failed peers after successful ones complete
- **Connection quality**: Track initial connection success rates
- **Background refresh**: Periodic automatic peer status updates 