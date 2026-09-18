package com.androiduse.autopilot.adapter

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.androiduse.autopilot.R
import com.androiduse.autopilot.model.Task
import com.google.android.material.card.MaterialCardView
import java.text.SimpleDateFormat
import java.util.*

class TaskConversationAdapter(
    private val onTaskClicked: ((Task) -> Unit)? = null,
    private val onTaskLongClicked: ((Task) -> Unit)? = null
) : ListAdapter<Task, TaskConversationAdapter.ConversationViewHolder>(TaskDiffCallback()) {

    class ConversationViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val userMessageCard: MaterialCardView = itemView.findViewById(R.id.userMessageCard)
        val userTimestamp: TextView = itemView.findViewById(R.id.userTimestamp)
        val userMessage: TextView = itemView.findViewById(R.id.userMessage)
        val agentTimestamp: TextView = itemView.findViewById(R.id.agentTimestamp)
        val agentCard: MaterialCardView = itemView.findViewById(R.id.agentCard)
        val statusIcon: ImageView = itemView.findViewById(R.id.statusIcon)
        val statusBadge: TextView = itemView.findViewById(R.id.statusBadge)
        val stepCount: TextView = itemView.findViewById(R.id.stepCount)
        val agentResponse: TextView = itemView.findViewById(R.id.agentResponse)
        val errorDetails: TextView = itemView.findViewById(R.id.errorDetails)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ConversationViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_task_conversation, parent, false)
        return ConversationViewHolder(view)
    }

    override fun onBindViewHolder(holder: ConversationViewHolder, position: Int) {
        val task = getItem(position)
        val context = holder.itemView.context

        // User message
        holder.userMessage.text = task.goal
        holder.userTimestamp.text = formatTime(task.createdAt)

        // Agent timestamp
        holder.agentTimestamp.text = if (task.completedAt != null) {
            formatTime(task.completedAt)
        } else {
            formatRelativeTime(task.createdAt)
        }

        // Status-based styling
        when (task.status.lowercase()) {
            "completed" -> {
                holder.agentCard.setCardBackgroundColor(ContextCompat.getColor(context, R.color.status_success))
                holder.statusIcon.setImageResource(R.drawable.ic_check_circle)
                holder.statusBadge.text = "Completed"
            }
            "failed" -> {
                holder.agentCard.setCardBackgroundColor(ContextCompat.getColor(context, R.color.status_error))
                holder.statusIcon.setImageResource(R.drawable.ic_error_outline)
                holder.statusBadge.text = "Failed"
            }
            "timed_out" -> {
                holder.agentCard.setCardBackgroundColor(ContextCompat.getColor(context, R.color.androiduse_orange))
                holder.statusIcon.setImageResource(R.drawable.ic_hourglass)
                holder.statusBadge.text = "Timed Out"
            }
            "running", "in_progress" -> {
                holder.agentCard.setCardBackgroundColor(ContextCompat.getColor(context, R.color.androiduse_primary))
                holder.statusIcon.setImageResource(R.drawable.ic_sync)
                holder.statusBadge.text = "Running"
            }
            else -> {
                holder.agentCard.setCardBackgroundColor(ContextCompat.getColor(context, R.color.background_card))
                holder.statusIcon.setImageResource(R.drawable.ic_hourglass)
                holder.statusBadge.text = "Pending"
            }
        }

        // Step count
        if (task.totalSteps > 0) {
            holder.stepCount.visibility = View.VISIBLE
            holder.stepCount.text = "${task.totalSteps} step${if (task.totalSteps != 1) "s" else ""}"
        } else {
            holder.stepCount.visibility = View.GONE
        }

        // Response message
        val isTerminal = task.status.lowercase() in listOf("completed", "failed", "timed_out")
        holder.agentResponse.text = when {
            task.response != null -> task.response
            task.status.lowercase() == "completed" -> "Task completed successfully."
            task.status.lowercase() == "failed" -> task.error ?: "Task failed. Please try again."
            task.status.lowercase() == "timed_out" -> "Task timed out. The operation took too long to complete."
            task.status.lowercase() in listOf("running", "in_progress") -> "Working on your task..."
            else -> "Task is queued and will start soon."
        }

        // Error details (show if error is different from response)
        if (task.error != null && task.response != null && task.error != task.response) {
            holder.errorDetails.visibility = View.VISIBLE
            holder.errorDetails.text = "Error: ${task.error}"
        } else {
            holder.errorDetails.visibility = View.GONE
        }

        // Click to copy user message to input
        holder.userMessageCard.setOnClickListener {
            onTaskClicked?.invoke(task)
        }

        // Long press for options (archive, share)
        holder.userMessageCard.setOnLongClickListener {
            onTaskLongClicked?.invoke(task)
            true
        }
    }

    private fun formatTime(timestamp: String): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            val date = sdf.parse(timestamp)
            if (date != null) {
                val outputFormat = SimpleDateFormat("h:mm a", Locale.getDefault())
                outputFormat.format(date)
            } else {
                timestamp
            }
        } catch (e: Exception) {
            try {
                // Try without milliseconds
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                val date = sdf.parse(timestamp)
                if (date != null) {
                    val outputFormat = SimpleDateFormat("h:mm a", Locale.getDefault())
                    outputFormat.format(date)
                } else {
                    timestamp
                }
            } catch (e: Exception) {
                timestamp
            }
        }
    }

    private fun formatRelativeTime(timestamp: String): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            val date = sdf.parse(timestamp)

            if (date != null) {
                val now = Date()
                val diff = now.time - date.time
                val minutes = diff / (60 * 1000)
                val hours = diff / (60 * 60 * 1000)

                when {
                    minutes < 1 -> "Just now"
                    minutes < 60 -> "$minutes min ago"
                    hours < 24 -> "$hours hr ago"
                    else -> formatTime(timestamp)
                }
            } else {
                timestamp
            }
        } catch (e: Exception) {
            timestamp
        }
    }

    class TaskDiffCallback : DiffUtil.ItemCallback<Task>() {
        override fun areItemsTheSame(oldItem: Task, newItem: Task): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Task, newItem: Task): Boolean {
            return oldItem == newItem
        }
    }
}
