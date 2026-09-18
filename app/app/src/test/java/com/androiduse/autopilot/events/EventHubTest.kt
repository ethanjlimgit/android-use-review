package com.androiduse.autopilot.events

import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.events.EventHub
import com.androiduse.autopilot.events.model.EventType
import com.androiduse.autopilot.events.model.AndroidUseEvent
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class EventHubTest {
    @Before
    fun setUp() {
        resetEventHubState()
    }

    @Test
    fun emit_withoutInit_allowsEventsByDefault() {
        val received = mutableListOf<AndroidUseEvent>()
        EventHub.subscribe { received.add(it) }

        val event = AndroidUseEvent(EventType.NOTIFICATION, timestamp = 1L, payload = "x")
        EventHub.emit(event)

        assertEquals(listOf(event), received)
    }

    @Test
    fun emit_withConfigDisabled_doesNotNotifyListener() {
        val config = mockk<ConfigManager>()
        every { config.isEventEnabled(EventType.NOTIFICATION) } returns false
        EventHub.init(config)

        val received = mutableListOf<AndroidUseEvent>()
        EventHub.subscribe { received.add(it) }

        EventHub.emit(AndroidUseEvent(EventType.NOTIFICATION, timestamp = 1L, payload = "x"))

        assertTrue(received.isEmpty())
        verify(exactly = 1) { config.isEventEnabled(EventType.NOTIFICATION) }
    }

    @Test
    fun emit_allowsPongAndUnknownEvenWhenDisabledInConfig() {
        val config = mockk<ConfigManager>()
        every { config.isEventEnabled(any()) } returns false
        EventHub.init(config)

        val received = mutableListOf<AndroidUseEvent>()
        EventHub.subscribe { received.add(it) }

        val pong = AndroidUseEvent(EventType.PONG, timestamp = 1L)
        val unknown = AndroidUseEvent(EventType.UNKNOWN, timestamp = 2L)

        EventHub.emit(pong)
        EventHub.emit(unknown)

        assertEquals(listOf(pong, unknown), received)
        verify(exactly = 0) { config.isEventEnabled(EventType.PONG) }
        verify(exactly = 0) { config.isEventEnabled(EventType.UNKNOWN) }
    }

    private fun resetEventHubState() {
        val instance = EventHub
        EventHub::class.java.getDeclaredField("serverListener").apply {
            isAccessible = true
            set(instance, null)
        }
        EventHub::class.java.getDeclaredField("configManager").apply {
            isAccessible = true
            set(instance, null)
        }
    }
}
