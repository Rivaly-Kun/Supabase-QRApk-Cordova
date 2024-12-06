const supabaseUrl = 'https://oyjytztjoxmxxelrqzfs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95anl0enRqb3hteHhlbHJxemZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIxNzI3MzgsImV4cCI6MjA0Nzc0ODczOH0.pM2b5_8UMdWnWrWXykYdYggEyJrOlv-3T_x8Ls_lQCw';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let html5QrcodeScanner = null;

const startScanBtn = document.getElementById('start-scan');
const stopScanBtn = document.getElementById('stop-scan');
const resultDiv = document.getElementById('result');
const eventSelect = document.getElementById('event-select');
const refresh = document.getElementById('refresh');

const qrConfig = {
    fps: 30,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
};

function onRefreshClick() {
    loadEvents();
}

refresh.addEventListener('click', onRefreshClick);

async function loadEvents() {
    try {
        eventSelect.innerHTML = ''; // Clear dropdown options

        const { data: events, error } = await supabaseClient
            .from('events')
            .select('*')
            .gte('time_starts', new Date().toISOString())
            .order('time_starts', { ascending: true });

        if (error) throw error;

        events.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            const eventDate = new Date(event.time_starts);
            option.textContent = `${event.name} - ${eventDate.toLocaleString()}`;
            eventSelect.appendChild(option);
        });

        eventSelect.addEventListener('change', () => {
            startScanBtn.disabled = !eventSelect.value;
        });
    } catch (err) {
        showError('Error loading events. Please refresh the app.');
        console.error('Error loading events:', err);
    }
}

function onScanSuccess(decodedText) {
    stopScanner();
    processAttendance(decodedText);
}

function onScanFailure(error) {
    console.warn(`QR scan error: ${error}`);
}

async function startScanner() {
    if (!eventSelect.value) {
        showError('Please select an event first.');
        return;
    }

    try {
        html5QrcodeScanner = new Html5Qrcode("reader");
        await html5QrcodeScanner.start(
            { facingMode: "environment" },
            qrConfig,
            onScanSuccess,
            onScanFailure
        );

        startScanBtn.disabled = true;
        stopScanBtn.disabled = false;
        eventSelect.disabled = true;

        showResult({
            status: 'READY',
            message: 'Camera started successfully. Ready to scan QR codes.'
        });
    } catch (err) {
        showError("Unable to access camera. Please check permissions.");
        console.error("Scanner error:", err);
    }
}

async function stopScanner() {
    if (html5QrcodeScanner) {
        try {
            await html5QrcodeScanner.stop();
            html5QrcodeScanner = null;
            startScanBtn.disabled = false;
            stopScanBtn.disabled = true;
            eventSelect.disabled = false;
        } catch (err) {
            console.error("Error stopping scanner:", err);
        }
    }
}

async function processAttendance(studentDatabaseId) {
    try {
        const selectedEventId = parseInt(eventSelect.value);
        if (!selectedEventId) throw new Error('No event selected.');

        // Fetch student by scanned ID
        const { data: student, error: studentError } = await supabaseClient
            .from('students')
            .select('*')
            .eq('id', studentDatabaseId)
            .single();

        if (studentError) {
            console.error('Student fetch error:', studentError);
            throw new Error('Student not found or invalid ID.');
        }

        // Fetch event by selected event ID
        const { data: event, error: eventError } = await supabaseClient
            .from('events')
            .select('*')
            .eq('id', selectedEventId)
            .single();

        if (eventError) {
            console.error('Event fetch error:', eventError);
            throw new Error('Event not found or invalid ID.');
        }

        const currentTime = new Date();
        const eventStartTime = new Date(event.time_starts);
        const eventEndTime = new Date(eventStartTime.getTime() + 2 * 60 * 60 * 1000);

        // Check for existing attendance record
        const { data: existingAttendance, error: existingAttendanceError } = await supabaseClient
            .from('attendance')
            .select('*')
            .eq('student_id', student.id)
            .eq('event_id', selectedEventId)
            .maybeSingle();

        if (existingAttendanceError) {
            console.error('Attendance fetch error:', existingAttendanceError);
            throw new Error('Error checking existing attendance.');
        }

        if (existingAttendance) {
            showResult({
                student,
                status: 'ALREADY_RECORDED',
                message: 'Attendance already recorded for this event.',
                scannedAt: currentTime
            });
            return;
        }

        // Check time constraints
        if (currentTime < eventStartTime) {
            showResult({
                student,
                status: 'TOO_EARLY',
                message: 'Too early - Event has not started yet.',
                scannedAt: currentTime
            });
            return;
        }

        if (currentTime > eventEndTime) {
            showResult({
                student,
                status: 'MISSED',
                message: 'Event has ended.',
                scannedAt: currentTime
            });
            return;
        }

        // Insert new attendance record
        const { error: attendanceError } = await supabaseClient
            .from('attendance')
            .insert([{
                id: crypto.randomUUID(), // Generate a UUID for the 'id' column
                student_id: student.id,
                event_id: selectedEventId,
                status: 'PRESENT',
                scanned_at: currentTime.toISOString()
            }]);

        if (attendanceError) {
            console.error('Error details:', attendanceError);
            throw new Error('Error recording attendance.');
        }

        // Success
        showResult({
            student,
            status: 'PRESENT',
            message: 'Attendance recorded successfully!',
            scannedAt: currentTime
        });
    } catch (err) {
        showError(err.message);
        console.error('Error processing attendance:', err);
    }
}



function showResult({ status, message, student, scannedAt }) {
    const statusClass = {
        PRESENT: 'present',
        MISSED: 'late',
        TOO_EARLY: 'early',
        ALREADY_RECORDED: 'present'
    }[status] || '';

    resultDiv.innerHTML = `
        <div class="status-message ${statusClass}">
            <strong>${student ? student.name : ''}</strong><br>
            ${message}<br>
            ${scannedAt ? `Scanned at: ${scannedAt.toLocaleString()}` : ''}
        </div>
    `;
}

function showError(message) {
    resultDiv.innerHTML = `<div class="camera-error">${message}</div>`;
}

startScanBtn.addEventListener('click', startScanner);
stopScanBtn.addEventListener('click', stopScanner);

loadEvents();